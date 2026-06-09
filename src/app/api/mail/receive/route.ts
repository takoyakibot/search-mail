import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { classifyMail } from "@/lib/classify-mail";

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSenderName(from: string): string {
  const match = from.match(/^"?([^"<]+)"?\s*</);
  return match ? match[1].trim() : from;
}

function resolveTenantId(to: string, domain: string): string | null {
  const match = to.match(new RegExp(`([^@\\s<]+)@${domain.replace(/\./g, "\\.")}`));
  return match ? match[1] : null;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const to = (formData.get("to") as string) || "";
    const from = (formData.get("from") as string) || "";
    const subject = (formData.get("subject") as string) || "";
    const text = (formData.get("text") as string) || "";
    const html = (formData.get("html") as string) || "";
    const messageId =
      (formData.get("headers") as string)?.match(/Message-ID:\s*<?([^>\s]+)>?/i)?.[1] || null;

    // メール本文の抽出（テキスト優先、なければHTMLからテキスト変換）
    const bodyText = text || stripHtml(html);

    // テナント特定
    const inboundDomain = process.env.INBOUND_EMAIL_DOMAIN || "inbound.yourdomain.com";
    const tenantIdentifier = resolveTenantId(to, inboundDomain);

    if (!tenantIdentifier) {
      console.error("Could not resolve tenant from address:", to);
      return NextResponse.json({ error: "Unknown tenant" }, { status: 400 });
    }

    // テナント検索
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("id")
      .eq("domain", tenantIdentifier)
      .single();

    if (!tenant) {
      console.error("Tenant not found:", tenantIdentifier);
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // 重複チェック
    if (messageId) {
      const { data: existing } = await supabaseAdmin
        .from("mails")
        .select("id")
        .eq("message_id", messageId)
        .single();

      if (existing) {
        return NextResponse.json({ message: "Duplicate mail, skipped" }, { status: 200 });
      }
    }

    // Claude API で分類
    const classification = await classifyMail(subject, bodyText, from);

    // Supabase に保存
    const { error: insertError } = await supabaseAdmin.from("mails").insert({
      tenant_id: tenant.id,
      message_id: messageId,
      subject,
      sender: from,
      sender_name: extractSenderName(from),
      received_at: new Date().toISOString(),
      body_text: bodyText,
      body_summary: classification.summary,
      category: classification.category,
      priority: classification.priority,
      related_people: classification.related_people,
      action_required: classification.action_required,
      tags: classification.tags,
      ai_raw_response: classification as unknown as Record<string, unknown>,
    });

    if (insertError) {
      console.error("Failed to insert mail:", insertError);
      return NextResponse.json({ error: "Failed to save mail" }, { status: 500 });
    }

    // 保存したメールのIDを取得
    const { data: savedMail } = await supabaseAdmin
      .from("mails")
      .select("id")
      .eq("message_id", messageId)
      .single();

    // 添付ファイルの保存 + 非同期解析キック
    const attachmentCount = parseInt((formData.get("attachments") as string) || "0", 10);
    const attachmentIds: string[] = [];

    for (let i = 1; i <= attachmentCount; i++) {
      const file = formData.get(`attachment${i}`) as File | null;
      if (!file) continue;

      const buffer = Buffer.from(await file.arrayBuffer());
      const storagePath = `${tenant.id}/${Date.now()}_${file.name}`;

      await supabaseAdmin.storage
        .from("attachments")
        .upload(storagePath, buffer, { contentType: file.type });

      if (savedMail) {
        const fileExt = file.name.split(".").pop()?.toLowerCase();
        const fileType =
          fileExt === "xlsx" || fileExt === "xls"
            ? "excel"
            : fileExt === "pdf"
              ? "pdf"
              : fileExt === "docx" || fileExt === "doc"
                ? "word"
                : "other";

        const { data: inserted } = await supabaseAdmin
          .from("attachments")
          .insert({
            mail_id: savedMail.id,
            tenant_id: tenant.id,
            file_name: file.name,
            file_type: fileType,
            storage_path: storagePath,
            status: "pending",
          })
          .select("id")
          .single();

        if (inserted) attachmentIds.push(inserted.id);
      }
    }

    // 添付ファイル解析を非同期でキック（レスポンスをブロックしない）
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    for (const attId of attachmentIds) {
      fetch(`${appUrl}/api/attachments/process`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ attachmentId: attId }),
      }).catch((err) => console.error("Failed to kick attachment processing:", err));
    }

    return NextResponse.json({ message: "Mail received and classified" }, { status: 200 });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
