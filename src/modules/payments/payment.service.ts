import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { getStripe } from "../../lib/stripe";
import { ApiError } from "../../utils/ApiError";

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

export const paymentService = { createCheckout };
