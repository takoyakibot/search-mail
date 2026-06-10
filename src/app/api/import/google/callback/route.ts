import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/app-url";
import { parseEml, classifyAndSave } from "@/lib/import/parse-email";

async function exchangeCodeForToken(code: string): Promise<{ access_token: string }> {
  const appUrl = getAppUrl();
  const redirectUri = `${appUrl}/api/import/google/callback`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
  return res.json();
}

type GmailListResponse = {
  messages: { id: string }[];
};

async function fetchMessageIds(accessToken: string, limit: number = 100): Promise<string[]> {
  const res = await fetch(
    `https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=${limit}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) throw new Error(`Gmail API failed: ${res.status}`);
  const data: GmailListResponse = await res.json();
  return (data.messages || []).map((m) => m.id);
}

async function fetchRawMessage(accessToken: string, messageId: string): Promise<string> {
  const res = await fetch(
    `https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=raw`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) throw new Error(`Gmail API failed: ${res.status}`);
  const data = await res.json();
  // Gmail API はBASE64URL エンコードで返す
  return Buffer.from(data.raw, "base64url").toString("utf-8");
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const userId = searchParams.get("state");

  if (!code || !userId) {
    return NextResponse.redirect(new URL("/import?error=auth_failed", request.url));
  }

  try {
    const { access_token } = await exchangeCodeForToken(code);

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("tenant_id")
      .eq("id", userId)
      .single();

    if (!profile?.tenant_id) {
      return NextResponse.redirect(new URL("/import?error=tenant_not_found", request.url));
    }

    const messageIds = await fetchMessageIds(access_token);

    let imported = 0;
    let skipped = 0;

    for (const msgId of messageIds) {
      try {
        const rawEmail = await fetchRawMessage(access_token, msgId);
        const emailData = await parseEml(rawEmail);
        const result = await classifyAndSave(emailData, profile.tenant_id, supabaseAdmin);

        if (result.skipped) {
          skipped++;
        } else {
          imported++;
        }
      } catch (err) {
        console.error("Failed to import Gmail message:", err);
      }
    }

    const appUrl = getAppUrl();
    return NextResponse.redirect(
      `${appUrl}/import?success=google&imported=${imported}&skipped=${skipped}`
    );
  } catch (error) {
    console.error("Google import error:", error);
    return NextResponse.redirect(new URL("/import?error=import_failed", request.url));
  }
}
