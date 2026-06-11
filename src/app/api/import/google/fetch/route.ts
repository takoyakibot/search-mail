import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { createSupabaseServer } from "@/lib/supabase/auth-server";
import { parseEml, classifyAndSave } from "@/lib/import/parse-email";
import { getValidAccessToken } from "@/lib/oauth-tokens";

const BATCH_SIZE = 20;

type GmailListResponse = {
  messages?: { id: string }[];
  nextPageToken?: string;
};

async function fetchMessageIds(
  accessToken: string,
  pageToken?: string
): Promise<{ ids: string[]; nextPageToken?: string }> {
  let url = `https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=${BATCH_SIZE}`;
  if (pageToken) url += `&pageToken=${pageToken}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) throw new Error(`Gmail API failed: ${res.status}`);
  const data: GmailListResponse = await res.json();
  return {
    ids: (data.messages || []).map((m) => m.id),
    nextPageToken: data.nextPageToken,
  };
}

async function fetchRawMessage(accessToken: string, messageId: string): Promise<string> {
  const res = await fetch(
    `https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=raw`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) throw new Error(`Gmail API failed: ${res.status}`);
  const data = await res.json();
  return Buffer.from(data.raw, "base64url").toString("utf-8");
}

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

  // クッキー → DB（リフレッシュ対応）の順でトークン取得
  let accessToken = request.cookies.get("gmail_access_token")?.value;
  if (!accessToken) {
    accessToken = await getValidAccessToken(profile.tenant_id, "google") ?? undefined;
  }
  if (!accessToken) {
    return NextResponse.json({ error: "Gmail access token not found. Please reconnect." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const pageToken = body.pageToken || undefined;

    // メッセージID一覧を取得
    const { ids, nextPageToken } = await fetchMessageIds(accessToken, pageToken);

    // メール本文を並列取得
    const rawEmails = await Promise.allSettled(
      ids.map((msgId) => fetchRawMessage(accessToken, msgId))
    );

    let imported = 0;
    let skipped = 0;
    let failed = 0;

    // 解析・保存を並列実行
    const saveResults = await Promise.allSettled(
      rawEmails.map(async (result) => {
        if (result.status === "rejected") throw result.reason;
        const emailData = await parseEml(result.value);
        return classifyAndSave(emailData, profile.tenant_id, supabaseAdmin);
      })
    );

    for (const result of saveResults) {
      if (result.status === "rejected") {
        console.error("Failed to import Gmail message:", result.reason);
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
      nextPageToken: nextPageToken || null,
      hasMore: !!nextPageToken,
    });
  } catch (error) {
    console.error("Gmail fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch Gmail messages" }, { status: 500 });
  }
}
