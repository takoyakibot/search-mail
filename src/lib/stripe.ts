import Stripe from "stripe";

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-05-27.dahlia",
    })
  : null;

export const PLANS = {
  free: {
    name: "Free",
    price: 0,
    emailLimit: 500,
    priceId: null,
  },
  standard: {
    name: "Standard",
    price: 9800,
    emailLimit: 5000,
    priceId: process.env.STRIPE_STANDARD_PRICE_ID || "",
  },
  enterprise: {
    name: "Enterprise",
    price: 29800,
    emailLimit: 50000,
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || "",
  },
} as const;
