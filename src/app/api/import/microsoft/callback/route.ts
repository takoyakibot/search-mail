import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/app-url";
import { saveTokens } from "@/lib/oauth-tokens";

async function exchangeCodeForToken(code: string) {
  const appUrl = getAppUrl();
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

  if (!code) {
    return NextResponse.redirect(`${appUrl}/import?error=auth_failed`);
  }

  try {
    const tokenData = await exchangeCodeForToken(code);

    // テナントID取得
    if (userId) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("tenant_id")
        .eq("id", userId)
        .single();

      if (profile?.tenant_id) {
        await saveTokens(
          profile.tenant_id,
          userId,
          "microsoft",
          tokenData.access_token,
          tokenData.refresh_token || null,
          tokenData.expires_in
        );
      }
    }

    const response = NextResponse.redirect(`${appUrl}/import?provider=microsoft`);
    response.cookies.set("msgraph_access_token", tokenData.access_token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 3600,
      path: "/",
    });
    return response;
  } catch (error) {
    console.error("Microsoft callback error:", error);
    return NextResponse.redirect(`${appUrl}/import?error=import_failed`);
  }
}
