import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { createSupabaseServer } from "@/lib/supabase/auth-server";
import { parseEml, classifyAndSave } from "@/lib/import/parse-email";

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

  try {
    const body = await request.json();
    const rawEmails: string[] = body.emails || [];

    if (rawEmails.length === 0) {
      return NextResponse.json({ error: "メールデータがありません" }, { status: 400 });
    }

    const results = { imported: 0, skipped: 0, failed: 0 };

    for (const raw of rawEmails) {
      try {
        const email = await parseEml(raw);
        const result = await classifyAndSave(email, profile.tenant_id, supabaseAdmin);
        if (result.skipped) {
          results.skipped++;
        } else {
          results.imported++;
        }
      } catch {
        results.failed++;
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json({ error: "インポート処理中にエラーが発生しました" }, { status: 500 });
  }
}
