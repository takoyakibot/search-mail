import { supabaseAdmin } from "@/lib/supabase/server";

type Provider = "google" | "microsoft";

type TokenRecord = {
  id: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
};

export async function saveTokens(
  tenantId: string,
  userId: string,
  provider: Provider,
  accessToken: string,
  refreshToken: string | null,
  expiresInSeconds?: number
) {
  const expiresAt = expiresInSeconds
    ? new Date(Date.now() + expiresInSeconds * 1000).toISOString()
    : null;

  // upsert: 同じテナント+プロバイダーなら更新
  await supabaseAdmin
    .from("oauth_tokens")
    .upsert(
      {
        tenant_id: tenantId,
        user_id: userId,
        provider,
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,provider" }
    );
}

export async function getValidAccessToken(
  tenantId: string,
  provider: Provider
): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("oauth_tokens")
    .select("id, access_token, refresh_token, expires_at")
    .eq("tenant_id", tenantId)
    .eq("provider", provider)
    .single();

  if (!data) return null;

  const token = data as TokenRecord;

  // 期限チェック（5分の余裕を持つ）
  if (token.expires_at) {
    const expiresAt = new Date(token.expires_at).getTime();
    const now = Date.now() + 5 * 60 * 1000;

    if (now >= expiresAt) {
      // 期限切れ → リフレッシュ
      if (!token.refresh_token) return null;

      const refreshed = await refreshAccessToken(provider, token.refresh_token);
      if (!refreshed) return null;

      // 新しいトークンを保存
      await supabaseAdmin
        .from("oauth_tokens")
        .update({
          access_token: refreshed.accessToken,
          refresh_token: refreshed.refreshToken || token.refresh_token,
          expires_at: refreshed.expiresIn
            ? new Date(Date.now() + refreshed.expiresIn * 1000).toISOString()
            : token.expires_at,
          updated_at: new Date().toISOString(),
        })
        .eq("id", token.id);

      return refreshed.accessToken;
    }
  }

  return token.access_token;
}

async function refreshAccessToken(
  provider: Provider,
  refreshToken: string
): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number } | null> {
  try {
    if (provider === "google") {
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
      });

      if (!res.ok) return null;
      const data = await res.json();
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
      };
    }

    if (provider === "microsoft") {
      const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.MICROSOFT_CLIENT_ID!,
          client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
      });

      if (!res.ok) return null;
      const data = await res.json();
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
      };
    }

    return null;
  } catch (error) {
    console.error(`Failed to refresh ${provider} token:`, error);
    return null;
  }
}
