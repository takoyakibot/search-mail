"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";

type TenantInfo = {
  tenantId: string;
  tenantName: string;
  domain: string;
  plan: string;
  emailLimit: number;
  inboundAddress: string;
  skipNewsletters: boolean;
  excludeSenders: string[];
};

export default function SettingsPage() {
  const router = useRouter();
  const [info, setInfo] = useState<TenantInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [skipNewsletters, setSkipNewsletters] = useState(true);
  const [excludeSenders, setExcludeSenders] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    fetch("/api/settings/tenant")
      .then((res) => {
        if (res.status === 401) {
          router.push("/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) {
          setInfo(data);
          setSkipNewsletters(data.skipNewsletters ?? true);
          setExcludeSenders((data.excludeSenders || []).join("\n"));
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [router]);

  const handleSaveFilters = async () => {
    setSaving(true);
    setSaveMessage("");

    const senders = excludeSenders
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const res = await fetch("/api/settings/tenant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skipNewsletters, excludeSenders: senders }),
      });

      if (res.ok) {
        setSaveMessage("保存しました");
        setTimeout(() => setSaveMessage(""), 3000);
      } else {
        setSaveMessage("保存に失敗しました");
      }
    } catch {
      setSaveMessage("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-gray-500">読み込み中...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

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

            {/* メールフィルター設定 */}
            <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
              <h3 className="font-semibold text-gray-900">インポートフィルター</h3>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="skipNewsletters"
                  checked={skipNewsletters}
                  onChange={(e) => setSkipNewsletters(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <label htmlFor="skipNewsletters" className="text-sm text-gray-700">
                  メルマガ・自動配信メールを自動的にスキップする
                </label>
              </div>
              <p className="text-xs text-gray-500 ml-7">
                List-Unsubscribe ヘッダー、noreply@ 等の送信者パターン、件名パターンで判定します
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  除外する送信者（1行に1つ）
                </label>
                <textarea
                  value={excludeSenders}
                  onChange={(e) => setExcludeSenders(e.target.value)}
                  rows={5}
                  placeholder={"@example.com\nnoreply@company.co.jp\nmarketing@"}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  メールアドレスの全体または一部、@ドメイン形式で指定できます
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleSaveFilters}
                  disabled={saving}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "保存中..." : "保存"}
                </button>
                {saveMessage && (
                  <span className={`text-sm ${saveMessage.includes("失敗") ? "text-red-600" : "text-green-600"}`}>
                    {saveMessage}
                  </span>
                )}
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
