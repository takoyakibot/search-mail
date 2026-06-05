"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { Database } from "@/types/database";

type Mail = Database["public"]["Tables"]["mails"]["Row"];

const categoryColors: Record<string, string> = {
  "人材関連": "bg-blue-100 text-blue-800",
  "案件・プロジェクト": "bg-green-100 text-green-800",
  "アンケート・調査": "bg-yellow-100 text-yellow-800",
  "営業・受注": "bg-purple-100 text-purple-800",
  "その他": "bg-gray-100 text-gray-800",
};

const priorityColors: Record<string, string> = {
  "高": "bg-red-100 text-red-800",
  "中": "bg-orange-100 text-orange-800",
  "低": "bg-slate-100 text-slate-600",
};

export default function MailDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [mail, setMail] = useState<Mail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/mails/${id}`)
      .then((res) => res.json())
      .then((data) => setMail(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-gray-500">読み込み中...</div>;
  }

  if (!mail) {
    return <div className="flex min-h-screen items-center justify-center text-gray-500">メールが見つかりません</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-4">
          <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
            &larr; 一覧に戻る
          </Link>
          <h1 className="text-xl font-bold text-gray-900">メール詳細</h1>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-4 px-4 py-6">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${categoryColors[mail.category || "その他"]}`}>
              {mail.category}
            </span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${priorityColors[mail.priority || "低"]}`}>
              優先度: {mail.priority}
            </span>
            {mail.action_required && (
              <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-medium text-white">
                要対応
              </span>
            )}
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              mail.status === "完了" ? "bg-green-100 text-green-800" : mail.status === "処理中" ? "bg-yellow-100 text-yellow-800" : "bg-gray-100 text-gray-800"
            }`}>
              {mail.status}
            </span>
          </div>

          <h2 className="mb-2 text-lg font-semibold">{mail.subject || "(件名なし)"}</h2>

          <div className="mb-4 space-y-1 text-sm text-gray-600">
            <p><span className="font-medium">送信者:</span> {mail.sender_name || mail.sender}</p>
            <p><span className="font-medium">送信元アドレス:</span> {mail.sender}</p>
            <p><span className="font-medium">受信日時:</span> {mail.received_at ? new Date(mail.received_at).toLocaleString("ja-JP") : "-"}</p>
          </div>

          {mail.body_summary && (
            <div className="mb-4 rounded-md bg-blue-50 p-3">
              <p className="text-xs font-medium text-blue-700">AI要約</p>
              <p className="text-sm text-blue-900">{mail.body_summary}</p>
            </div>
          )}

          {mail.related_people && mail.related_people.length > 0 && (
            <div className="mb-4">
              <p className="mb-1 text-xs font-medium text-gray-500">関連人物</p>
              <div className="flex flex-wrap gap-1">
                {mail.related_people.map((person) => (
                  <span key={person} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{person}</span>
                ))}
              </div>
            </div>
          )}

          {mail.tags && mail.tags.length > 0 && (
            <div className="mb-4">
              <p className="mb-1 text-xs font-medium text-gray-500">タグ</p>
              <div className="flex flex-wrap gap-1">
                {mail.tags.map((tag) => (
                  <span key={tag} className="rounded bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">{tag}</span>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-gray-200 pt-4">
            <p className="mb-2 text-xs font-medium text-gray-500">本文</p>
            <pre className="whitespace-pre-wrap text-sm text-gray-800">{mail.body_text}</pre>
          </div>
        </div>
      </main>
    </div>
  );
}
