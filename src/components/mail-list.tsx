"use client";

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

const statusOptions = ["未処理", "処理中", "完了"];

type MailListProps = {
  mails: Mail[];
  onStatusChange: (id: string, status: string) => void;
};

export function MailList({ mails, onStatusChange }: MailListProps) {
  if (mails.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
        メールが見つかりません
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">カテゴリ</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">優先度</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">件名</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">送信者</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">要約</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">受信日時</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">処理状況</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {mails.map((mail) => (
            <tr key={mail.id} className="hover:bg-gray-50">
              <td className="whitespace-nowrap px-4 py-3">
                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${categoryColors[mail.category || "その他"] || categoryColors["その他"]}`}>
                  {mail.category || "その他"}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${priorityColors[mail.priority || "低"] || priorityColors["低"]}`}>
                  {mail.priority || "低"}
                </span>
              </td>
              <td className="max-w-[200px] truncate px-4 py-3 text-sm">
                <Link href={`/dashboard/${mail.id}`} className="text-blue-600 hover:underline">
                  {mail.subject || "(件名なし)"}
                </Link>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                {mail.sender_name || mail.sender || "-"}
              </td>
              <td className="max-w-[250px] truncate px-4 py-3 text-sm text-gray-500">
                {mail.body_summary || "-"}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                {mail.received_at
                  ? new Date(mail.received_at).toLocaleString("ja-JP")
                  : "-"}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <select
                  value={mail.status}
                  onChange={(e) => onStatusChange(mail.id, e.target.value)}
                  className={`rounded border px-2 py-1 text-xs ${
                    mail.status === "完了"
                      ? "border-green-300 bg-green-50 text-green-700"
                      : mail.status === "処理中"
                        ? "border-yellow-300 bg-yellow-50 text-yellow-700"
                        : "border-gray-300 bg-gray-50 text-gray-700"
                  }`}
                >
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
