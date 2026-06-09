import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { extractTextFromFile } from "@/lib/attachments/extract-text";
import { classifySkillsheet } from "@/lib/attachments/classify-skillsheet";

export async function POST(request: NextRequest) {
  // 内部呼び出し用の簡易認証（Webhook からの非同期呼び出し）
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { attachmentId } = await request.json();

    if (!attachmentId) {
      return NextResponse.json({ error: "attachmentId is required" }, { status: 400 });
    }

    // 添付ファイル情報取得
    const { data: attachment, error: fetchError } = await supabaseAdmin
      .from("attachments")
      .select("*")
      .eq("id", attachmentId)
      .single();

    if (fetchError || !attachment) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    if (attachment.status !== "pending") {
      return NextResponse.json({ message: "Already processed" }, { status: 200 });
    }

    // Storage からファイル取得
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from("attachments")
      .download(attachment.storage_path);

    if (downloadError || !fileData) {
      await supabaseAdmin
        .from("attachments")
        .update({ status: "failed" })
        .eq("id", attachmentId);
      return NextResponse.json({ error: "Failed to download file" }, { status: 500 });
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());

    // テキスト抽出
    const { text, isPasswordProtected } = await extractTextFromFile(
      buffer,
      attachment.file_name || "unknown"
    );

    // パスワード付きファイル
    if (isPasswordProtected) {
      await supabaseAdmin
        .from("attachments")
        .update({ status: "skipped" })
        .eq("id", attachmentId);
      return NextResponse.json({ message: "Password protected, skipped" }, { status: 200 });
    }

    // テキストが空の場合
    if (!text.trim()) {
      await supabaseAdmin
        .from("attachments")
        .update({
          status: "processed",
          extracted_text: "",
        })
        .eq("id", attachmentId);
      return NextResponse.json({ message: "No text extracted" }, { status: 200 });
    }

    // Claude API でスキルシート分類
    const result = await classifySkillsheet(text, attachment.file_name || "unknown");

    // DB更新
    await supabaseAdmin
      .from("attachments")
      .update({
        extracted_text: text.slice(0, 10000),
        structured_data: result as unknown as Record<string, unknown>,
        person_name: result.person_name,
        skills: result.skills,
        available_from: result.available_from,
        status: "processed",
      })
      .eq("id", attachmentId);

    return NextResponse.json({ message: "Processed successfully", result });
  } catch (error) {
    console.error("Attachment processing error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
