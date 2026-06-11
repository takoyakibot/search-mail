import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { createSupabaseServer } from "@/lib/supabase/auth-server";
import { classifyAndSave, type ParsedEmailData } from "@/lib/import/parse-email";
import { getValidAccessToken } from "@/lib/oauth-tokens";

const BATCH_SIZE = 20;

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

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchEmails(
  accessToken: string,
  skipToken?: string
): Promise<{ messages: GraphMessage[]; nextLink: string | null }> {
  let url: string;
  if (skipToken) {
    url = skipToken;
  } else {
    url = `https://graph.microsoft.com/v1.0/me/messages?$top=${BATCH_SIZE}&$orderby=receivedDateTime desc&$select=id,internetMessageId,subject,from,receivedDateTime,body,hasAttachments`;
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) throw new Error(`Graph API failed: ${res.status}`);
  const data = await res.json();
  return {
    messages: data.value || [],
    nextLink: data["@odata.nextLink"] || null,
  };
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

  let accessToken = request.cookies.get("msgraph_access_token")?.value;
  if (!accessToken) {
    accessToken = await getValidAccessToken(profile.tenant_id, "microsoft") ?? undefined;
  }
  if (!accessToken) {
    return NextResponse.json({ error: "Microsoft access token not found. Please reconnect." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const skipToken = body.skipToken || undefined;

    const { messages, nextLink } = await fetchEmails(accessToken, skipToken);

    let imported = 0;
    let skipped = 0;
    let failed = 0;

    // メール解析・保存を並列実行
    const saveResults = await Promise.allSettled(
      messages.map(async (msg) => {
        const bodyText = msg.body.contentType === "html"
          ? stripHtml(msg.body.content)
          : msg.body.content;

        const attachments: ParsedEmailData["attachments"] = [];

        if (msg.hasAttachments) {
          const atts = await fetchAttachments(accessToken, msg.id);
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

        return classifyAndSave(emailData, profile.tenant_id, supabaseAdmin);
      })
    );

    for (const result of saveResults) {
      if (result.status === "rejected") {
        console.error("Failed to import message:", result.reason);
        failed++;
      } else if (result.value.skipped) {
        skipped++;
      } else {
        imported++;
      }
    }

    return NextResponse.json({
      imported,
      skipped,
      failed,
      skipToken: nextLink,
      hasMore: !!nextLink,
    });
  } catch (error) {
    console.error("Microsoft fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch Microsoft messages" }, { status: 500 });
  }
}
