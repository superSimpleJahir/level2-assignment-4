import Stripe from "stripe";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";

let client: Stripe | null = null;

// Created lazily so the rest of the API still boots (and can be demoed)
// before a Stripe key has been added to .env
export const getStripe = (): Stripe => {
  if (!env.STRIPE_SECRET_KEY) {
    throw new ApiError(503, "Payments are not configured on this server (missing STRIPE_SECRET_KEY)");
  }
  if (!client) client = new Stripe(env.STRIPE_SECRET_KEY);
  return client;
};

// Used for verifying webhook signatures. Needs no API key, only the webhook secret.
export const stripeWebhooks = new Stripe("sk_unused_webhook_verifier").webhooks;
