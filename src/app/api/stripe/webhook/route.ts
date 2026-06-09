import { NextRequest, NextResponse } from "next/server";
import { stripe, PLANS } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/server";
import type Stripe from "stripe";

export async function POST(request: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const tenantId = session.metadata?.tenantId;
      const plan = session.metadata?.plan;

      if (tenantId && plan) {
        const planConfig = PLANS[plan as keyof typeof PLANS];
        await supabaseAdmin
          .from("tenants")
          .update({
            plan,
            email_limit: planConfig?.emailLimit || 500,
            stripe_customer_id: session.customer as string,
          })
          .eq("id", tenantId);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      const { data: tenant } = await supabaseAdmin
        .from("tenants")
        .select("id")
        .eq("stripe_customer_id", customerId)
        .single();

      if (tenant) {
        await supabaseAdmin
          .from("tenants")
          .update({ plan: "free", email_limit: 500 })
          .eq("id", tenant.id);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
