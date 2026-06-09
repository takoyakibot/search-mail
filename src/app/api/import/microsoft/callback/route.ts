import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { classifyAndSave, type ParsedEmailData } from "@/lib/import/parse-email";

async function exchangeCodeForToken(code: string): Promise<{ access_token: string }> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const redirectUri = `${appUrl}/api/import/microsoft/callback`;

  const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status}`);
  }

  return res.json();
}

type GraphMessage = {
  id: string;
  internetMessageId: string | null;
  subject: string;
  from: { emailAddress: { name: string; address: string } };
  receivedDateTime: string;
  body: { content: string; contentType: string };
  hasAttachments: boolean;
};

type GraphAttachment = {
  name: string;
  contentType: string;
  contentBytes: string;
};

async function fetchEmails(accessToken: string, limit: number = 100): Promise<GraphMessage[]> {
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages?$top=${limit}&$orderby=receivedDateTime desc&$select=id,internetMessageId,subject,from,receivedDateTime,body,hasAttachments`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) throw new Error(`Graph API failed: ${res.status}`);
  const data = await res.json();
  return data.value;
}

async function fetchAttachments(accessToken: string, messageId: string): Promise<GraphAttachment[]> {
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages/${messageId}/attachments`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) return [];
  const data = await res.json();
  return data.value.filter((a: { "@odata.type": string }) => a["@odata.type"] === "#microsoft.graph.fileAttachment");
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const userId = searchParams.get("state");

  if (!code || !userId) {
    return NextResponse.redirect(new URL("/import?error=auth_failed", request.url));
  }

  try {
    // トークン取得
    const { access_token } = await exchangeCodeForToken(code);

    // ユーザーのテナントID取得
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("tenant_id")
      .eq("id", userId)
      .single();

    if (!profile?.tenant_id) {
      return NextResponse.redirect(new URL("/import?error=tenant_not_found", request.url));
    }

    // メール取得
    const messages = await fetchEmails(access_token);

    let imported = 0;
    let skipped = 0;

    for (const msg of messages) {
      try {
        const bodyText = msg.body.contentType === "html"
          ? stripHtml(msg.body.content)
          : msg.body.content;

        const attachments: ParsedEmailData["attachments"] = [];

        if (msg.hasAttachments) {
          const atts = await fetchAttachments(access_token, msg.id);
          for (const att of atts) {
            attachments.push({
              fileName: att.name,
              contentType: att.contentType,
              content: Buffer.from(att.contentBytes, "base64"),
            });
          }
        }

        const emailData: ParsedEmailData = {
          messageId: msg.internetMessageId,
          subject: msg.subject || "(件名なし)",
          sender: msg.from?.emailAddress?.address || "",
          senderName: msg.from?.emailAddress?.name || "",
          receivedAt: msg.receivedDateTime,
          bodyText,
          attachments,
        };

        const result = await classifyAndSave(emailData, profile.tenant_id, supabaseAdmin);
        if (result.skipped) {
          skipped++;
        } else {
          imported++;
        }
      } catch (err) {
        console.error("Failed to import message:", err);
      }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return NextResponse.redirect(
      `${appUrl}/import?success=microsoft&imported=${imported}&skipped=${skipped}`
    );
  } catch (error) {
    console.error("Microsoft import error:", error);
    return NextResponse.redirect(new URL("/import?error=import_failed", request.url));
  }
}
