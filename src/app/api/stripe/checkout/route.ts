import { NextRequest, NextResponse } from "next/server";
import { stripe, PLANS } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/server";
import { createSupabaseServer } from "@/lib/supabase/auth-server";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile?.tenant_id) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const { data: tenant } = await supabaseAdmin
    .from("tenants")
    .select("*")
    .eq("id", profile.tenant_id)
    .single();

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const { plan } = await request.json();
  const planConfig = PLANS[plan as keyof typeof PLANS];

  if (!planConfig || !planConfig.priceId) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // 既存の Stripe Customer がある場合はそれを使う
  let customerId = tenant.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { tenantId: tenant.id },
    });
    customerId = customer.id;

    await supabaseAdmin
      .from("tenants")
      .update({ stripe_customer_id: customerId })
      .eq("id", tenant.id);
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: planConfig.priceId, quantity: 1 }],
    success_url: `${appUrl}/settings?checkout=success`,
    cancel_url: `${appUrl}/settings?checkout=cancelled`,
    metadata: { tenantId: tenant.id, plan },
  });

  return NextResponse.json({ url: session.url });
}
