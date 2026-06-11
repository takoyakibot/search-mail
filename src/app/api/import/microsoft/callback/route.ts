import { NextRequest, NextResponse } from "next/server";
import { getAppUrl } from "@/lib/app-url";

async function exchangeCodeForToken(code: string): Promise<{ access_token: string }> {
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
  return res.json();
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const appUrl = getAppUrl();

  if (!code) {
    return NextResponse.redirect(`${appUrl}/import?error=auth_failed`);
  }

  try {
    const { access_token } = await exchangeCodeForToken(code);

    const response = NextResponse.redirect(`${appUrl}/import?provider=microsoft`);
    response.cookies.set("msgraph_access_token", access_token, {
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
