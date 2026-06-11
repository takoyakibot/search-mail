import { NextResponse } from "next/server";
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
    return NextResponse.json({ providers: [] });
  }

  const { data: tokens } = await supabaseAdmin
    .from("oauth_tokens")
    .select("provider")
    .eq("tenant_id", profile.tenant_id);

  const providers = (tokens || []).map((t: { provider: string }) => t.provider);

  return NextResponse.json({ providers });
}
