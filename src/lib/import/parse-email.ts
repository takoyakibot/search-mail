import { simpleParser, type ParsedMail } from "mailparser";
import crypto from "crypto";
import { classifyMail } from "@/lib/classify-mail";
import { getAppUrl } from "@/lib/app-url";
import { extractTextFromFile } from "@/lib/attachments/extract-text";

export type ParsedEmailData = {
  messageId: string | null;
  subject: string;
  sender: string;
  senderName: string;
  receivedAt: string;
  bodyText: string;
  attachments: {
    fileName: string;
    contentType: string;
    content: Buffer;
  }[];
};

function extractSenderName(from: string): string {
  const match = from.match(/^"?([^"<]+)"?\s*</);
  return match ? match[1].trim() : from;
}

export async function parseEml(raw: Buffer | string): Promise<ParsedEmailData> {
  const parsed: ParsedMail = await simpleParser(raw);

  const sender = parsed.from?.text || "";
  const bodyText = parsed.text || "";

  const attachments = (parsed.attachments || []).map((att) => ({
    fileName: att.filename || "unknown",
    contentType: att.contentType || "application/octet-stream",
    content: att.content,
  }));

  // messageId がない場合はハッシュで生成
  const messageId = parsed.messageId
    || `hash-${crypto.createHash("sha256").update(`${parsed.subject || ""}|${sender}|${parsed.date?.toISOString() || ""}|${bodyText.slice(0, 200)}`).digest("hex").slice(0, 16)}`;

  return {
    messageId,
    subject: parsed.subject || "(件名なし)",
    sender,
    senderName: extractSenderName(sender),
    receivedAt: parsed.date?.toISOString() || new Date().toISOString(),
    bodyText,
    attachments,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function classifyAndSave(
  email: ParsedEmailData,
  tenantId: string,
  supabaseAdmin: any
) {
  // 重複チェック
  if (email.messageId) {
    const { data: existing } = await supabaseAdmin
      .from("mails")
      .select("id")
      .eq("message_id", email.messageId)
      .single();

    if (existing) return { skipped: true, mailId: existing.id };
  }

  // AI分類
  const classification = await classifyMail(
    email.subject,
    email.bodyText,
    email.sender
  );

  // メール保存（重複時はスキップ）
  const { data: mail, error } = await supabaseAdmin
    .from("mails")
    .upsert(
      {
        tenant_id: tenantId,
        message_id: email.messageId,
        subject: email.subject,
        sender: email.sender,
        sender_name: email.senderName,
        received_at: email.receivedAt,
        body_text: email.bodyText,
        body_summary: classification.summary,
        category: classification.category,
        priority: classification.priority,
        related_people: classification.related_people,
        action_required: classification.action_required,
        tags: classification.tags,
        ai_raw_response: classification as unknown as Record<string, unknown>,
      },
      { onConflict: "message_id", ignoreDuplicates: true }
    )
    .select("id")
    .single();

  // upsert + ignoreDuplicates の場合、重複時は data が null になる
  if (!mail) {
    // 重複で挿入されなかった → 既存レコードを取得
    const { data: existing } = await supabaseAdmin
      .from("mails")
      .select("id")
      .eq("message_id", email.messageId)
      .single();

    if (existing) return { skipped: true, mailId: existing.id };
    if (error) throw new Error(`Failed to save mail: ${error?.message}`);
    return { skipped: true, mailId: null };
  }

  // 添付ファイル保存
  for (const att of email.attachments) {
    const storagePath = `${tenantId}/${Date.now()}_${att.fileName}`;

    await supabaseAdmin.storage
      .from("attachments")
      .upload(storagePath, att.content, { contentType: att.contentType });

    const fileExt = att.fileName.split(".").pop()?.toLowerCase();
    const fileType =
      fileExt === "xlsx" || fileExt === "xls"
        ? "excel"
        : fileExt === "pdf"
          ? "pdf"
          : fileExt === "docx" || fileExt === "doc"
            ? "word"
            : "other";

    // テキスト抽出（AI無し）
    let extractedText = "";
    let attachmentStatus = "pending";
    try {
      if (fileType !== "other") {
        const { text, isPasswordProtected } = await extractTextFromFile(att.content, att.fileName);
        if (isPasswordProtected) {
          attachmentStatus = "skipped";
        } else {
          extractedText = text.slice(0, 10000);
          attachmentStatus = "processed";
        }
      }
    } catch (err) {
      console.error("Failed to extract text from attachment:", err);
    }

    await supabaseAdmin
      .from("attachments")
      .insert({
        mail_id: mail.id,
        tenant_id: tenantId,
        file_name: att.fileName,
        file_type: fileType,
        storage_path: storagePath,
        extracted_text: extractedText,
        status: attachmentStatus,
      });
  }

  return { skipped: false, mailId: mail.id };
}
