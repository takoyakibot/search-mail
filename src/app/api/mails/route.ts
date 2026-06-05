import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const q = searchParams.get("q") || "";
  const category = searchParams.get("category") || "";
  const priority = searchParams.get("priority") || "";
  const status = searchParams.get("status") || "";
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const tenantId = searchParams.get("tenant_id") || "";

  if (!tenantId) {
    return NextResponse.json({ error: "tenant_id is required" }, { status: 400 });
  }

  let query = supabaseAdmin
    .from("mails")
    .select("*", { count: "exact" })
    .eq("tenant_id", tenantId)
    .order("received_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (q) {
    query = query.or(
      `subject.ilike.%${q}%,body_text.ilike.%${q}%,sender.ilike.%${q}%,sender_name.ilike.%${q}%`
    );
  }
  if (category) {
    query = query.eq("category", category);
  }
  if (priority) {
    query = query.eq("priority", priority);
  }
  if (status) {
    query = query.eq("status", status);
  }
  if (from) {
    query = query.gte("received_at", from);
  }
  if (to) {
    query = query.lte("received_at", to);
  }

  const { data, count, error } = await query;

  if (error) {
    console.error("Failed to fetch mails:", error);
    return NextResponse.json({ error: "Failed to fetch mails" }, { status: 500 });
  }

  return NextResponse.json({
    mails: data,
    total: count,
    page,
    limit,
  });
}
