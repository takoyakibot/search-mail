"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

type TenantInfo = {
  tenantId: string;
  tenantName: string;
  domain: string;
  plan: string;
  emailLimit: number;
  inboundAddress: string;
};

export default function SettingsPage() {
  const router = useRouter();
  const [info, setInfo] = useState<TenantInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings/tenant")
      .then((res) => {
        if (res.status === 401) {
          router.push("/login");
          return null;
        }
        return res.json();
      })
      .then((data) => data && setInfo(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [router]);

  const handleLogout = async () => {
    const supabase = createSupabaseBrowser();
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-gray-500">読み込み中...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900">MailSort</h1>
          <nav className="flex items-center gap-4 text-sm">
            <a href="/dashboard" className="text-gray-600 hover:text-gray-900">ダッシュボード</a>
            <a href="/settings" className="font-medium text-blue-600">設定</a>
            <button onClick={handleLogout} className="text-gray-500 hover:text-gray-700">
              ログアウト
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <h2 className="text-lg font-semibold text-gray-900">テナント設定</h2>

        {info && (
          <>
            <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
              <div>
                <p className="text-xs font-medium text-gray-500">会社名</p>
                <p className="text-sm text-gray-900">{info.tenantName}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">プラン</p>
                <p className="text-sm text-gray-900">{info.plan}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">月間メール上限</p>
                <p className="text-sm text-gray-900">{info.emailLimit} 件</p>
              </div>
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-6 space-y-4">
              <h3 className="font-semibold text-blue-900">メール転送設定</h3>
              <div>
                <p className="text-xs font-medium text-blue-700">転送先アドレス</p>
                <code className="mt-1 block rounded bg-white px-3 py-2 text-sm font-mono text-blue-900 border border-blue-200">
                  {info.inboundAddress}
                </code>
              </div>
              <div className="space-y-3 text-sm text-blue-800">
                <h4 className="font-medium">設定手順</h4>

                <div>
                  <p className="font-medium">Gmail の場合：</p>
                  <ol className="ml-4 list-decimal space-y-1 text-blue-700">
                    <li>Gmail の「設定」→「メール転送と POP/IMAP」を開く</li>
                    <li>「転送先アドレスを追加」をクリック</li>
                    <li>上記の転送先アドレスを入力</li>
                    <li>確認メールのリンクをクリックして転送を有効化</li>
                  </ol>
                </div>

                <div>
                  <p className="font-medium">Exchange / Outlook の場合：</p>
                  <ol className="ml-4 list-decimal space-y-1 text-blue-700">
                    <li>Exchange 管理センター → メールフロー → ルールを開く</li>
                    <li>「新しいルール」→「受信メールを転送」を選択</li>
                    <li>上記の転送先アドレスを設定</li>
                    <li>ルールを保存して有効化</li>
                  </ol>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
