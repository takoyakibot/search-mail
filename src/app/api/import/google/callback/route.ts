import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/app-url";

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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const userId = searchParams.get("state");
  const appUrl = getAppUrl();

  if (!code || !userId) {
    return NextResponse.redirect(`${appUrl}/import?error=auth_failed`);
  }

  try {
    const { access_token } = await exchangeCodeForToken(code);

    // アクセストークンをクッキーに一時保存（フロント側でバッチ取得するため）
    const response = NextResponse.redirect(`${appUrl}/import?provider=google`);
    response.cookies.set("gmail_access_token", access_token, {
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
