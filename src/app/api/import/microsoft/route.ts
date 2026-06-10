import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/auth-server";
import { getAppUrl } from "@/lib/app-url";

export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "Microsoft連携が設定されていません" }, { status: 503 });
  }

  const appUrl = getAppUrl();
  const redirectUri = `${appUrl}/api/import/microsoft/callback`;
  const scope = "https://graph.microsoft.com/Mail.Read offline_access";

  const authUrl = new URL("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", scope);
  authUrl.searchParams.set("state", user.id);

  return NextResponse.json({ url: authUrl.toString() });
}
