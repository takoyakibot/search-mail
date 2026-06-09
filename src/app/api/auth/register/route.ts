import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const { userId, tenantName, name } = await request.json();

    if (!userId || !tenantName || !name) {
      return NextResponse.json({ error: "必須項目が不足しています" }, { status: 400 });
    }

    // テナント作成（domain はテナント識別子として短いIDを生成）
    const domain = `tenant-${crypto.randomBytes(4).toString("hex")}`;

    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .insert({ name: tenantName, domain })
      .select("id")
      .single();

    if (tenantError || !tenant) {
      console.error("Failed to create tenant:", tenantError);
      return NextResponse.json({ error: "テナントの作成に失敗しました" }, { status: 500 });
    }

    // プロフィール作成
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({ id: userId, tenant_id: tenant.id, name, role: "admin" });

    if (profileError) {
      console.error("Failed to create profile:", profileError);
      return NextResponse.json({ error: "プロフィールの作成に失敗しました" }, { status: 500 });
    }

    return NextResponse.json({
      tenantId: tenant.id,
      domain,
      message: "登録が完了しました",
    });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json({ error: "登録処理中にエラーが発生しました" }, { status: 500 });
  }
}
