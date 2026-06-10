"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function ImportNotification() {
  const searchParams = useSearchParams();
  const success = searchParams.get("success");
  const importedCount = searchParams.get("imported");
  const skippedCount = searchParams.get("skipped");
  const error = searchParams.get("error");

  return (
    <>
      {success && (
        <div className="rounded-md bg-green-50 p-4 text-sm text-green-800">
          {success === "microsoft" ? "Microsoft" : "Google"} から{importedCount}件インポートしました
          （{skippedCount}件スキップ）
        </div>
      )}
      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">
          エラーが発生しました: {error}
        </div>
      )}
    </>
  );
}

export default function ImportPage() {
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    imported: number;
    skipped: number;
    failed: number;
    errors: string[];
  } | null>(null);

  const handleFileUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setUploading(true);
    setUploadResult(null);

    const formData = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/import/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (res.ok) {
        setUploadResult(data);
      } else {
        setUploadResult({ imported: 0, skipped: 0, failed: 1, errors: [data.error] });
      }
    } catch {
      setUploadResult({ imported: 0, skipped: 0, failed: 1, errors: ["通信エラーが発生しました"] });
    } finally {
      setUploading(false);
    }
  };

  const handleMicrosoftConnect = async () => {
    try {
      const res = await fetch("/api/import/microsoft");
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Microsoft連携に失敗しました");
      }
    } catch {
      alert("通信エラーが発生しました");
    }
  };

  const handleGoogleConnect = async () => {
    try {
      const res = await fetch("/api/import/google");
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Google連携に失敗しました");
      }
    } catch {
      alert("通信エラーが発生しました");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900">MailSort</h1>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">ダッシュボード</Link>
            <Link href="/import" className="font-medium text-blue-600">インポート</Link>
            <Link href="/settings" className="text-gray-600 hover:text-gray-900">設定</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        <Suspense fallback={null}>
          <ImportNotification />
        </Suspense>

        {/* 1. ファイルアップロード */}
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-1 text-lg font-semibold text-gray-900">ファイルからインポート</h2>
          <p className="mb-4 text-sm text-gray-500">
            メーラーからエクスポートした .eml / .mbox ファイルをアップロードしてください。
            複数ファイルを同時に選択できます。
          </p>

          <form onSubmit={handleFileUpload}>
            <input
              type="file"
              name="files"
              accept=".eml,.mbox"
              multiple
              className="mb-3 block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
            />
            <button
              type="submit"
              disabled={uploading}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {uploading ? "インポート中..." : "アップロードしてインポート"}
            </button>
          </form>

          {uploadResult && (
            <div className="mt-4 rounded-md bg-gray-50 p-3 text-sm">
              <p>インポート: {uploadResult.imported}件 / スキップ: {uploadResult.skipped}件 / 失敗: {uploadResult.failed}件</p>
              {uploadResult.errors.length > 0 && (
                <ul className="mt-2 list-inside list-disc text-red-600">
                  {uploadResult.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        {/* 2. Microsoft 365 / Exchange Online */}
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-1 text-lg font-semibold text-gray-900">Microsoft 365 / Exchange Online</h2>
          <p className="mb-4 text-sm text-gray-500">
            Microsoftアカウントで認証し、受信メールを一括インポートします。
            パスワードはMailSortには保存されません。
          </p>
          <button
            onClick={handleMicrosoftConnect}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Microsoftアカウントで接続
          </button>
        </section>

        {/* 3. Gmail / Google Workspace */}
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-1 text-lg font-semibold text-gray-900">Gmail / Google Workspace</h2>
          <p className="mb-4 text-sm text-gray-500">
            Googleアカウントで認証し、受信メールを一括インポートします。
            パスワードはMailSortには保存されません。
          </p>
          <button
            onClick={handleGoogleConnect}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Googleアカウントで接続
          </button>
        </section>

        {/* エクスポート手順ガイド */}
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">メールのエクスポート方法</h2>
          <div className="space-y-4 text-sm text-gray-600">
            <div>
              <h3 className="font-medium text-gray-900">Outlook（デスクトップ版）</h3>
              <p>ファイル &gt; 開く/エクスポート &gt; インポート/エクスポート &gt; ファイルにエクスポート &gt; Outlook データファイル(.pst) を選択。PSTファイルは直接対応していないため、個別メールを .eml で保存（ドラッグ&ドロップ）してください。</p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Thunderbird</h3>
              <p>ImportExportTools NG アドオンを追加 &gt; フォルダを右クリック &gt; ImportExportTools NG &gt; フォルダ内のすべてのメッセージをエクスポート &gt; EML形式を選択。</p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Gmail（Google Takeout）</h3>
              <p><a href="https://takeout.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">takeout.google.com</a> にアクセス &gt; 「メール」のみ選択 &gt; エクスポート。MBOX形式でダウンロードされます。</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
