import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/app-url";
import { saveTokens } from "@/lib/oauth-tokens";
import crypto from "crypto";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const appUrl = getAppUrl();

  if (!code) {
    return NextResponse.redirect(`${appUrl}/login?error=auth_failed`);
  }

  const response = NextResponse.redirect(`${appUrl}/dashboard`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // コードをセッションに交換
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    return NextResponse.redirect(`${appUrl}/login?error=auth_failed`);
  }

  const user = data.session.user;
  const providerToken = data.session.provider_token;
  const providerRefreshToken = data.session.provider_refresh_token;

  // プロバイダー判定
  const provider = user.app_metadata?.provider;
  const isGoogle = provider === "google";
  const isMicrosoft = provider === "azure";

  // プロフィール確認・作成
  const { data: existingProfile } = await supabaseAdmin
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  let tenantId = existingProfile?.tenant_id;

  if (!existingProfile) {
    // 新規ユーザー: テナント + プロフィールを自動作成
    const domain = `tenant-${crypto.randomBytes(4).toString("hex")}`;
    const userName = user.user_metadata?.full_name || user.email?.split("@")[0] || "User";
    const tenantName = user.user_metadata?.full_name
      ? `${userName}の組織`
      : `${user.email?.split("@")[1] || "default"}`;

    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .insert({ name: tenantName, domain })
      .select("id")
      .single();

    if (tenant) {
      tenantId = tenant.id;
      await supabaseAdmin
        .from("profiles")
        .insert({ id: user.id, tenant_id: tenant.id, name: userName, role: "admin" });
    }
  }

  // プロバイダートークンをDBに保存（メールインポート用）
  if (tenantId && providerToken) {
    const tokenProvider = isGoogle ? "google" : isMicrosoft ? "microsoft" : null;
    if (tokenProvider) {
      await saveTokens(
        tenantId,
        user.id,
        tokenProvider,
        providerToken,
        providerRefreshToken || null,
        3600
      );

      // クッキーにも保存（即時インポート用）
      const cookieName = isGoogle ? "gmail_access_token" : "msgraph_access_token";
      response.cookies.set(cookieName, providerToken, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 3600,
        path: "/",
      });
    }
  }

  return response;
}
