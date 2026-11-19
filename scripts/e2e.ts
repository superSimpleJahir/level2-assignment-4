/**
 * End-to-end smoke test for the whole FixItNow flow.
 *
 *   1. start the API:        npm run dev
 *   2. in another terminal:  npm run test:e2e
 *
 * Without STRIPE_SECRET_KEY the script cannot create a real Checkout Session,
 * so it inserts the pending payment itself and sends a correctly *signed*
 * webhook event - that exercises exactly the same code path Stripe would.
 */
import dotenv from "dotenv";
import Stripe from "stripe";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const BASE = process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 4000}/api`;
const prisma = new PrismaClient();

let passed = 0;
let failed = 0;

const check = (name: string, condition: boolean, extra?: unknown) => {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}`, extra ? JSON.stringify(extra) : "");
  }
};

type Res = { status: number; body: any };

const call = async (method: string, path: string, token?: string, body?: unknown): Promise<Res> => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
};

const login = async (email: string, password: string) => (await call("POST", "/auth/login", undefined, { email, password })).body?.data?.token as string;

const section = (title: string) => console.log(`\n== ${title}`);

// Next UTC weekday (Mon-Sat) at the given hour, a few weeks away so it never clashes with "now"
const futureSlot = (weeksAhead: number, hour: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + weeksAhead * 7);
  while (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
};

async function main() {
  const stamp = Date.now();
  const customerEmail = `e2e.customer.${stamp}@example.com`;
  const techEmail = `e2e.tech.${stamp}@example.com`;
  const hour = 9 + Math.floor(Math.random() * 6);
  const weeks = 4 + Math.floor(Math.random() * 40);

  section("Health & 404");
  check("GET /health", (await call("GET", "/health")).status === 200);
  const missing = await call("GET", "/does-not-exist");
  check("unknown route -> 404 structured error", missing.status === 404 && missing.body.success === false && "errorDetails" in missing.body);

  section("Auth & validation");
  const bad = await call("POST", "/auth/register", undefined, { name: "x", email: "nope", password: "1", role: "ADMIN" });
  check("invalid register -> 400 with field errors", bad.status === 400 && Array.isArray(bad.body.errorDetails) && bad.body.errorDetails.length >= 3);

  const regCustomer = await call("POST", "/auth/register", undefined, { name: "E2E Customer", email: customerEmail, password: "Passw0rd!", role: "CUSTOMER", address: "Dhaka" });
  check("register customer", regCustomer.status === 201 && !!regCustomer.body.data.token);
  const regTech = await call("POST", "/auth/register", undefined, { name: "E2E Tech", email: techEmail, password: "Passw0rd!", role: "TECHNICIAN" });
  check("register technician", regTech.status === 201);
  check("duplicate email -> 409", (await call("POST", "/auth/register", undefined, { name: "E2E Customer", email: customerEmail, password: "Passw0rd!", role: "CUSTOMER" })).status === 409);
  check("wrong password -> 401", (await call("POST", "/auth/login", undefined, { email: customerEmail, password: "wrong-pass1" })).status === 401);

  const customer = regCustomer.body.data.token as string;
  const tech = regTech.body.data.token as string;
  const admin = await login(process.env.ADMIN_EMAIL ?? "admin@fixitnow.com", process.env.ADMIN_PASSWORD ?? "Admin@12345");
  check("admin login works", !!admin);

  check("GET /auth/me without token -> 401", (await call("GET", "/auth/me")).status === 401);
  check("customer cannot open admin route -> 403", (await call("GET", "/admin/users", customer)).status === 403);

  section("Technician setup");
  const categories = await call("GET", "/categories");
  check("public categories", categories.status === 200 && categories.body.data.length > 0);
  const categoryId = categories.body.data[0].id as string;

  check("update profile", (await call("PUT", "/technician/profile", tech, { headline: "E2E fixer", skills: ["testing"], experienceYears: 3, hourlyRate: 10, city: "Dhaka" })).status === 200);
  check("overlapping slots rejected", (await call("PUT", "/technician/availability", tech, { slots: [{ dayOfWeek: 1, startTime: "09:00", endTime: "12:00" }, { dayOfWeek: 1, startTime: "11:00", endTime: "13:00" }] })).status === 400);
  const slots = [1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, startTime: "09:00", endTime: "18:00" }));
  check("set availability", (await call("PUT", "/technician/availability", tech, { slots })).status === 200);

  const svc = await call("POST", "/technician/services", tech, { title: "E2E test service", description: "A service created by the e2e script", categoryId, price: 25.5, durationMinutes: 60 });
  check("create service", svc.status === 201);
  const serviceId = svc.body.data.id as string;
  check("service validation (price <= 0)", (await call("POST", "/technician/services", tech, { title: "abc", description: "long enough description", categoryId, price: -1 })).status === 400);

  section("Public browsing");
  const list = await call("GET", "/services?search=E2E&sortBy=price&order=asc&limit=5");
  check("search + sort services", list.status === 200 && list.body.data.some((s: any) => s.id === serviceId) && !!list.body.meta);
  check("invalid query -> 400", (await call("GET", "/services?minPrice=50&maxPrice=10")).status === 400);
  const techList = await call("GET", "/technicians?city=Dhaka");
  check("list technicians", techList.status === 200);
  const techProfileId = svc.body.data.technicianId as string;
  check("technician details", (await call("GET", `/technicians/${techProfileId}`)).status === 200);

  section("Booking flow");
  const when = futureSlot(weeks, hour);
  check("past date rejected", (await call("POST", "/bookings", customer, { serviceId, scheduledAt: "2020-01-01T10:00:00Z", address: "Road 1, Dhaka" })).status === 400);
  const outside = new Date(when); outside.setUTCHours(22);
  check("outside availability rejected", (await call("POST", "/bookings", customer, { serviceId, scheduledAt: outside.toISOString(), address: "Road 1, Dhaka" })).status === 400);

  const booking = await call("POST", "/bookings", customer, { serviceId, scheduledAt: when.toISOString(), address: "Road 1, Dhaka", notes: "Please call first" });
  check("create booking", booking.status === 201 && booking.body.data.status === "REQUESTED", booking.body);
  const bookingId = booking.body.data.id as string;

  check("pay before accept -> 400", (await call("POST", "/payments/create", customer, { bookingId })).status === 400);
  check("technician accepts", (await call("PATCH", `/technician/bookings/${bookingId}`, tech, { status: "ACCEPTED" })).body?.data?.status === "ACCEPTED");
  check("double booking same slot -> 409", (await call("POST", "/bookings", customer, { serviceId, scheduledAt: when.toISOString(), address: "Road 1, Dhaka" })).status === 409);
  check("cannot jump ACCEPTED -> COMPLETED", (await call("PATCH", `/technician/bookings/${bookingId}`, tech, { status: "COMPLETED" })).status === 400);
  check("other customer cannot see booking", (await call("GET", `/bookings/${bookingId}`, await login("tania@example.com", "Customer@123"))).status === 404);

  section("Payment (Stripe)");
  const hasStripe = !!process.env.STRIPE_SECRET_KEY;
  const created = await call("POST", "/payments/create", customer, { bookingId });
  let sessionId: string;
  if (hasStripe) {
    check("create Stripe checkout session", created.status === 201 && !!created.body.data.checkoutUrl, created.body);
    sessionId = created.body.data.sessionId;
    console.log(`  INFO  open this URL, pay with 4242 4242 4242 4242, then re-run /payments/confirm:\n        ${created.body.data.checkoutUrl}`);
  } else {
    check("no Stripe key -> clean 503 error", created.status === 503 && created.body.success === false);
    sessionId = `cs_test_e2e_${stamp}`;
    await prisma.payment.create({ data: { bookingId, userId: regCustomer.body.data.user.id, checkoutSession: sessionId, amount: 25.5, currency: "usd", provider: "STRIPE", status: "PENDING" } });
    console.log("  INFO  STRIPE_SECRET_KEY not set - simulating Stripe by sending a signed webhook");
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET!;
  const event = JSON.stringify({
    id: `evt_e2e_${stamp}`,
    object: "event",
    type: "checkout.session.completed",
    data: { object: { id: sessionId, object: "checkout.session", payment_status: "paid", payment_intent: `pi_e2e_${stamp}`, payment_method_types: ["card"] } },
  });
  const stripe = new Stripe("sk_test_unused");
  const header = stripe.webhooks.generateTestHeaderString({ payload: event, secret });

  const unsigned = await fetch(`${BASE}/payments/webhook`, { method: "POST", headers: { "content-type": "application/json", "stripe-signature": "t=1,v1=bad" }, body: event });
  check("webhook with bad signature -> 400", unsigned.status === 400);

  if (!hasStripe) {
    const hook = await fetch(`${BASE}/payments/webhook`, { method: "POST", headers: { "content-type": "application/json", "stripe-signature": header }, body: event });
    check("signed webhook accepted", hook.status === 200);
    const again = await fetch(`${BASE}/payments/webhook`, { method: "POST", headers: { "content-type": "application/json", "stripe-signature": header }, body: event });
    check("webhook is idempotent", again.status === 200);
  }

  if (!hasStripe) {
    const paid = await call("GET", `/bookings/${bookingId}`, customer);
    check("booking is PAID after payment", paid.body.data.status === "PAID", paid.body.data?.status);
    const history = await call("GET", "/payments", customer);
    check("payment history lists COMPLETED payment", history.body.data.some((p: any) => p.status === "COMPLETED"));
    const detail = await call("GET", `/payments/${history.body.data[0].id}`, customer);
    check("payment details", detail.status === 200 && detail.body.data.transactionId?.startsWith("pi_e2e_"));
  }

  section("Job lifecycle & review");
  if (!hasStripe) {
    check("review before completion -> 400", (await call("POST", "/reviews", customer, { bookingId, rating: 5 })).status === 400);
    check("technician starts job", (await call("PATCH", `/technician/bookings/${bookingId}`, tech, { status: "IN_PROGRESS" })).status === 200);
    check("customer cannot cancel in-progress job", (await call("PATCH", `/bookings/${bookingId}/cancel`, customer)).status === 400);
    check("technician completes job", (await call("PATCH", `/technician/bookings/${bookingId}`, tech, { status: "COMPLETED" })).status === 200);
    check("rating out of range -> 400", (await call("POST", "/reviews", customer, { bookingId, rating: 9 })).status === 400);
    check("create review", (await call("POST", "/reviews", customer, { bookingId, rating: 5, comment: "Great job" })).status === 201);
    check("duplicate review -> 409", (await call("POST", "/reviews", customer, { bookingId, rating: 4 })).status === 409);
    const profile = await call("GET", `/technicians/${techProfileId}`);
    check("technician rating updated", profile.body.data.ratingAvg === 5 && profile.body.data.reviewCount === 1);
  }

  section("Cancel flow");
  const second = await call("POST", "/bookings", customer, { serviceId, scheduledAt: futureSlot(weeks + 1, hour).toISOString(), address: "Road 2, Dhaka" });
  check("create second booking", second.status === 201);
  check("customer cancels pending booking", (await call("PATCH", `/bookings/${second.body.data.id}/cancel`, customer)).body?.data?.status === "CANCELLED");

  section("Admin");
  const users = await call("GET", "/admin/users?role=TECHNICIAN&limit=5", admin);
  check("admin lists users", users.status === 200 && !!users.body.meta);
  const techUserId = regTech.body.data.user.id as string;
  check("admin bans technician", (await call("PATCH", `/admin/users/${techUserId}`, admin, { status: "BANNED" })).body?.data?.status === "BANNED");
  check("banned user is locked out", (await call("GET", "/auth/me", tech)).status === 403);
  check("banned user cannot log in", (await call("POST", "/auth/login", undefined, { email: techEmail, password: "Passw0rd!" })).status === 403);
  check("admin unbans technician", (await call("PATCH", `/admin/users/${techUserId}`, admin, { status: "ACTIVE" })).status === 200);
  check("admin lists bookings", (await call("GET", "/admin/bookings?status=COMPLETED", admin)).status === 200);
  check("admin lists payments", (await call("GET", "/admin/payments", admin)).status === 200);

  const cat = await call("POST", "/admin/categories", admin, { name: `E2E Category ${stamp}`, description: "temporary" });
  check("admin creates category", cat.status === 201);
  check("duplicate category -> 409", (await call("POST", "/admin/categories", admin, { name: `E2E Category ${stamp}` })).status === 409);
  check("admin deletes category", (await call("DELETE", `/admin/categories/${cat.body.data.id}`, admin)).status === 200);

  // ---- cleanup so the demo database stays tidy ----
  const ids = [regCustomer.body.data.user.id as string, techUserId];
  const bookings = await prisma.booking.findMany({ where: { customerId: ids[0] }, select: { id: true } });
  const bookingIds = bookings.map((b) => b.id);
  await prisma.review.deleteMany({ where: { bookingId: { in: bookingIds } } });
  await prisma.payment.deleteMany({ where: { bookingId: { in: bookingIds } } });
  await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

main()
  .catch((error) => {
    failed++;
    console.error("Test run crashed:", error);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  });
