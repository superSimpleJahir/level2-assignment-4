import Stripe from "stripe";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { getStripe, stripeWebhooks } from "../../lib/stripe";
import { ApiError } from "../../utils/ApiError";
import { buildMeta } from "../../utils/pagination";
import { Prisma, Role } from "@prisma/client";

const CURRENCY = "usd";

const toCents = (amount: unknown) => Math.round(Number(amount) * 100);

// Starts a Stripe Checkout for an ACCEPTED booking and returns the hosted payment page URL.
const createCheckout = async (customerId: string, bookingId: string) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      service: { select: { title: true, description: true } },
      customer: { select: { email: true } },
      payments: true,
    },
  });

  if (!booking || booking.customerId !== customerId) throw ApiError.notFound("Booking not found");

  if (booking.payments.some((p) => p.status === "COMPLETED")) {
    throw ApiError.conflict("This booking has already been paid");
  }
  if (booking.status !== "ACCEPTED") {
    throw ApiError.badRequest(
      booking.status === "REQUESTED"
        ? "You can pay only after the technician accepts the booking"
        : `A booking that is ${booking.status} cannot be paid`,
      { currentStatus: booking.status },
    );
  }

  const stripe = getStripe();

  // If the customer already opened a checkout and just came back, hand them the same page
  const pending = booking.payments.find((p) => p.status === "PENDING");
  if (pending) {
    const existing = await stripe.checkout.sessions.retrieve(pending.checkoutSession);
    if (existing.status === "open" && existing.url) {
      return { payment: pending, checkoutUrl: existing.url, sessionId: existing.id };
    }
    await prisma.payment.update({
      where: { id: pending.id },
      data: { status: "FAILED", failureReason: "Checkout session expired" },
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: booking.customer.email,
    client_reference_id: booking.id,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: CURRENCY,
          unit_amount: toCents(booking.totalAmount),
          product_data: { name: booking.service.title, description: booking.service.description.slice(0, 250) },
        },
      },
    ],
    metadata: { bookingId: booking.id, customerId },
    success_url: `${env.CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.CLIENT_URL}/payment/cancelled?booking_id=${booking.id}`,
  });

  const payment = await prisma.payment.create({
    data: {
      bookingId: booking.id,
      userId: customerId,
      checkoutSession: session.id,
      amount: booking.totalAmount,
      currency: CURRENCY,
      provider: "STRIPE",
      status: "PENDING",
    },
  });

  return { payment, checkoutUrl: session.url, sessionId: session.id };
};

// Sends the money back through Stripe and marks the payment REFUNDED
const refundPayment = async (paymentId: string, reason: string) => {
  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  if (payment.status !== "COMPLETED" || !payment.transactionId) return payment;

  await getStripe().refunds.create({ payment_intent: payment.transactionId });
  return prisma.payment.update({ where: { id: paymentId }, data: { status: "REFUNDED", failureReason: reason } });
};

// ---------------- Confirming payments ----------------

// Called from both the confirm endpoint and the webhook, so it must be safe to run twice.
// The conditional updateMany makes sure only one caller flips PENDING -> COMPLETED.
const completePayment = async (session: Stripe.Checkout.Session) => {
  const payment = await prisma.payment.findUnique({ where: { checkoutSession: session.id } });
  if (!payment) throw ApiError.notFound("No payment found for this checkout session");

  if (payment.status === "COMPLETED") return payment; // already handled

  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;

  await prisma.$transaction(async (tx) => {
    const updated = await tx.payment.updateMany({
      where: { id: payment.id, status: { in: ["PENDING", "FAILED"] } },
      data: {
        status: "COMPLETED",
        paidAt: new Date(),
        transactionId: paymentIntentId ?? session.id,
        method: session.payment_method_types?.[0] ?? "card",
        failureReason: null,
      },
    });
    if (updated.count === 0) return;

    // Only an ACCEPTED booking moves to PAID. If it was cancelled while the customer
    // was on the Stripe page, the money is refunded further down instead.
    await tx.booking.updateMany({ where: { id: payment.bookingId, status: "ACCEPTED" }, data: { status: "PAID" } });
  });

  const booking = await prisma.booking.findUniqueOrThrow({ where: { id: payment.bookingId } });
  if (booking.status === "CANCELLED") {
    await refundPayment(payment.id, "Booking was cancelled before the payment completed");
  }

  return prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
};

const failPayment = async (sessionId: string, reason: string) => {
  await prisma.payment.updateMany({
    where: { checkoutSession: sessionId, status: "PENDING" },
    data: { status: "FAILED", failureReason: reason },
  });
};

// Customer lands on the success page and the frontend calls this with the session id.
// We never trust the client: the session is re-fetched from Stripe and checked.
const confirm = async (customerId: string, sessionId: string) => {
  const payment = await prisma.payment.findUnique({ where: { checkoutSession: sessionId } });
  if (!payment || payment.userId !== customerId) throw ApiError.notFound("Payment not found");

  if (payment.status === "COMPLETED" || payment.status === "REFUNDED") return payment;

  const session = await getStripe().checkout.sessions.retrieve(sessionId);

  if (session.payment_status === "paid") return completePayment(session);

  if (session.status === "expired") {
    await failPayment(sessionId, "Checkout session expired");
    throw ApiError.badRequest("This payment session has expired. Please start a new payment.");
  }

  throw ApiError.badRequest("Payment has not been completed yet", { paymentStatus: session.payment_status });
};

// Stripe -> our server. The raw body is required to verify the signature.
const handleWebhook = async (rawBody: Buffer, signature: string | undefined) => {
  if (!env.STRIPE_WEBHOOK_SECRET) throw new ApiError(503, "Webhook secret is not configured");
  if (!signature) throw ApiError.badRequest("Missing Stripe-Signature header");

  let event: Stripe.Event;
  try {
    event = stripeWebhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    throw ApiError.badRequest(`Webhook signature verification failed: ${(error as Error).message}`);
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status === "paid") await completePayment(session);
      break;
    }
    case "checkout.session.expired":
    case "checkout.session.async_payment_failed": {
      const session = event.data.object as Stripe.Checkout.Session;
      await failPayment(session.id, event.type === "checkout.session.expired" ? "Checkout session expired" : "Payment failed");
      break;
    }
    default:
      // Other events are ignored on purpose
      break;
  }

  return { received: true, type: event.type };
};

// ---------------- History & details ----------------

const paymentInclude = {
  booking: {
    select: {
      id: true,
      status: true,
      scheduledAt: true,
      service: { select: { id: true, title: true } },
      technician: { select: { id: true, user: { select: { id: true, name: true } } } },
    },
  },
} satisfies Prisma.PaymentInclude;

type Viewer = { id: string; role: Role };

const list = async (user: Viewer, query: { status?: "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED"; page: number; limit: number }) => {
  // Customers see what they paid, technicians see payments for their jobs, admins see everything
  const owner: Prisma.PaymentWhereInput =
    user.role === "CUSTOMER"
      ? { userId: user.id }
      : user.role === "TECHNICIAN"
        ? { booking: { technician: { userId: user.id } } }
        : {};

  const where: Prisma.PaymentWhereInput = { ...owner, ...(query.status ? { status: query.status } : {}) };

  const [total, data] = await prisma.$transaction([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      include: paymentInclude,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  return { data, meta: buildMeta(query.page, query.limit, total) };
};

const getById = async (user: Viewer, id: string) => {
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      ...paymentInclude,
      booking: {
        select: { ...paymentInclude.booking.select, technician: { select: { id: true, userId: true, user: { select: { id: true, name: true } } } } },
      },
    },
  });
  if (!payment) throw ApiError.notFound("Payment not found");

  const allowed =
    user.role === "ADMIN" || payment.userId === user.id || payment.booking.technician.userId === user.id;
  if (!allowed) throw ApiError.notFound("Payment not found");

  return payment;
};

// ---------------- Cancelling a booking that is already paid ----------------

const refundForBooking = async (bookingId: string) => {
  const payment = await prisma.payment.findFirst({ where: { bookingId, status: "COMPLETED" } });
  if (payment) await refundPayment(payment.id, "Booking cancelled by customer");
};

// Stops a customer paying through an old Stripe page after the booking was cancelled
const expirePendingSessions = async (bookingId: string) => {
  const pending = await prisma.payment.findMany({ where: { bookingId, status: "PENDING" } });
  for (const payment of pending) {
    try {
      await getStripe().checkout.sessions.expire(payment.checkoutSession);
    } catch {
      // already expired or completed - nothing to do
    }
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failureReason: "Booking cancelled" } });
  }
};

export const paymentService = { createCheckout, confirm, handleWebhook, list, getById, refundForBooking, expirePendingSessions };
