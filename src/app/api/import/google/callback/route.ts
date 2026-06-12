import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/app-url";
import { saveTokens } from "@/lib/oauth-tokens";

async function exchangeCodeForToken(code: string) {
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
  return res.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  }>;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const userId = searchParams.get("state");
  const appUrl = getAppUrl();

  if (!code || !userId) {
    return NextResponse.redirect(`${appUrl}/import?error=auth_failed`);
  }

  try {
    const tokenData = await exchangeCodeForToken(code);

    // テナントID取得
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("tenant_id")
      .eq("id", userId)
      .single();

    // DBにトークン保存（リフレッシュトークン含む）
    if (profile?.tenant_id) {
      await saveTokens(
        profile.tenant_id,
        userId,
        "google",
        tokenData.access_token,
        tokenData.refresh_token || null,
        tokenData.expires_in
      );
    }

    // クッキーにも保存（即時インポート用）
    const response = NextResponse.redirect(`${appUrl}/import?provider=google`);
    response.cookies.set("gmail_access_token", tokenData.access_token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 3600,
      path: "/",
    });
    return response;
  } catch (error) {
    console.error("Google callback error:", error);
    return NextResponse.redirect(`${appUrl}/import?error=import_failed`);
  }
}
