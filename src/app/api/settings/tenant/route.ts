import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { createSupabaseServer } from "@/lib/supabase/auth-server";

export async function GET() {
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

  const inboundDomain = process.env.INBOUND_EMAIL_DOMAIN || "inbound.yourdomain.com";

  return NextResponse.json({
    tenantId: tenant.id,
    tenantName: tenant.name,
    domain: tenant.domain,
    plan: tenant.plan,
    emailLimit: tenant.email_limit,
    inboundAddress: `${tenant.domain}@${inboundDomain}`,
    skipNewsletters: tenant.skip_newsletters ?? true,
    excludeSenders: tenant.exclude_senders || [],
  });
}

export async function PATCH(request: NextRequest) {
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

  const body = await request.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = {};

  if ("skipNewsletters" in body) updates.skip_newsletters = body.skipNewsletters;
  if ("excludeSenders" in body) updates.exclude_senders = body.excludeSenders;
  if ("name" in body) updates.name = body.name;

  const { error } = await supabaseAdmin
    .from("tenants")
    .update(updates)
    .eq("id", profile.tenant_id);

  if (error) {
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }

  return NextResponse.json({ message: "Updated" });
}
