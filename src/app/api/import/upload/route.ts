import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { createSupabaseServer } from "@/lib/supabase/auth-server";
import { parseEml, classifyAndSave } from "@/lib/import/parse-email";

export async function POST(request: NextRequest) {
  // 認証チェック
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
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (files.length === 0) {
      return NextResponse.json({ error: "ファイルが選択されていません" }, { status: 400 });
    }

    const results = { imported: 0, skipped: 0, failed: 0, errors: [] as string[] };

    for (const file of files) {
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const fileName = file.name.toLowerCase();

        if (fileName.endsWith(".eml")) {
          // 単一EMLファイル
          const email = await parseEml(buffer);
          const result = await classifyAndSave(email, profile.tenant_id, supabaseAdmin);
          if (result.skipped) {
            results.skipped++;
          } else {
            results.imported++;
          }
        } else if (fileName.endsWith(".mbox")) {
          // MBOXファイル（複数メールが連結されたフォーマット）
          const mboxStr = buffer.toString("utf-8");
          const emailChunks = mboxStr.split(/^From /m).filter((chunk) => chunk.trim());

          for (const chunk of emailChunks) {
            try {
              const rawEmail = "From " + chunk;
              const email = await parseEml(rawEmail);
              const result = await classifyAndSave(email, profile.tenant_id, supabaseAdmin);
              if (result.skipped) {
                results.skipped++;
              } else {
                results.imported++;
              }
            } catch (err) {
              results.failed++;
              results.errors.push(`MBOX内メール: ${err instanceof Error ? err.message : "不明なエラー"}`);
            }
          }
        } else {
          results.failed++;
          results.errors.push(`${file.name}: 未対応の形式です（.eml または .mbox のみ）`);
        }
      } catch (err) {
        results.failed++;
        results.errors.push(`${file.name}: ${err instanceof Error ? err.message : "不明なエラー"}`);
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json({ error: "インポート処理中にエラーが発生しました" }, { status: 500 });
  }
}
