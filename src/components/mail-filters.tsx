"use client";

type MailFiltersProps = {
  query: string;
  category: string;
  priority: string;
  status: string;
  onQueryChange: (v: string) => void;
  onCategoryChange: (v: string) => void;
  onPriorityChange: (v: string) => void;
  onStatusChange: (v: string) => void;
};

const categories = ["人材関連", "案件・プロジェクト", "アンケート・調査", "営業・受注", "その他"];
const priorities = ["高", "中", "低"];
const statuses = ["未処理", "処理中", "完了"];

export function MailFilters({
  query,
  category,
  priority,
  status,
  onQueryChange,
  onCategoryChange,
  onPriorityChange,
  onStatusChange,
}: MailFiltersProps) {
  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
      <div>
        <input
          type="text"
          placeholder="キーワード検索（件名・本文・送信者・関連人物）"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <div className="flex flex-wrap gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">カテゴリ</label>
          <select
            value={category}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">すべて</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">優先度</label>
          <select
            value={priority}
            onChange={(e) => onPriorityChange(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">すべて</option>
            {priorities.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">処理状況</label>
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">すべて</option>
            {statuses.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
