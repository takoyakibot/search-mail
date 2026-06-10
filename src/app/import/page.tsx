"use client";

import { Suspense, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/header";

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

const BATCH_SIZE = 10;

function splitMbox(text: string): string[] {
  // MBOX format: each message starts with "From " at the beginning of a line
  const parts = text.split(/^From /m).filter((chunk) => chunk.trim());
  return parts.map((chunk) => "From " + chunk);
}

export default function ImportPage() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, imported: 0, skipped: 0, failed: 0 });
  const [uploadResult, setUploadResult] = useState<{
    imported: number;
    skipped: number;
    failed: number;
  } | null>(null);
  const abortRef = useRef(false);

  const handleFileUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setUploading(true);
    setUploadResult(null);
    abortRef.current = false;

    const formData = new FormData(e.currentTarget);
    const files = formData.getAll("files") as File[];

    if (files.length === 0) {
      setUploading(false);
      return;
    }

    const totals = { imported: 0, skipped: 0, failed: 0 };

    try {
      // 全ファイルからメールを抽出
      const allEmails: string[] = [];

      for (const file of files) {
        const text = await file.text();
        const fileName = file.name.toLowerCase();

        if (fileName.endsWith(".eml")) {
          allEmails.push(text);
        } else if (fileName.endsWith(".mbox")) {
          const emails = splitMbox(text);
          allEmails.push(...emails);
        }
      }

      setProgress({ current: 0, total: allEmails.length, imported: 0, skipped: 0, failed: 0 });

      // バッチに分割して送信
      for (let i = 0; i < allEmails.length; i += BATCH_SIZE) {
        if (abortRef.current) break;

        const batch = allEmails.slice(i, i + BATCH_SIZE);

        try {
          const res = await fetch("/api/import/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ emails: batch }),
          });

          if (res.ok) {
            const data = await res.json();
            totals.imported += data.imported || 0;
            totals.skipped += data.skipped || 0;
            totals.failed += data.failed || 0;
          } else {
            totals.failed += batch.length;
          }
        } catch {
          totals.failed += batch.length;
        }

        setProgress({
          current: Math.min(i + BATCH_SIZE, allEmails.length),
          total: allEmails.length,
          imported: totals.imported,
          skipped: totals.skipped,
          failed: totals.failed,
        });
      }

      setUploadResult(totals);
    } catch {
      setUploadResult({ imported: 0, skipped: 0, failed: 1 });
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    abortRef.current = true;
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
      <Header />

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        <Suspense fallback={null}>
          <ImportNotification />
        </Suspense>

        {/* 1. ファイルアップロード */}
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-1 text-lg font-semibold text-gray-900">ファイルからインポート</h2>
          <p className="mb-4 text-sm text-gray-500">
            メーラーからエクスポートした .eml / .mbox ファイルをアップロードしてください。
            大きなファイルも自動的に分割して処理します。
          </p>

          <form onSubmit={handleFileUpload}>
            <input
              type="file"
              name="files"
              accept=".eml,.mbox"
              multiple
              disabled={uploading}
              className="mb-3 block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={uploading}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {uploading ? "インポート中..." : "アップロードしてインポート"}
              </button>
              {uploading && (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  中止
                </button>
              )}
            </div>
          </form>

          {/* 進捗バー */}
          {uploading && progress.total > 0 && (
            <div className="mt-4 space-y-2">
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
              <p className="text-sm text-gray-600">
                {progress.current} / {progress.total} 件処理中
                （インポート: {progress.imported} / スキップ: {progress.skipped} / 失敗: {progress.failed}）
              </p>
            </div>
          )}

          {/* 結果表示 */}
          {uploadResult && !uploading && (
            <div className="mt-4 rounded-md bg-gray-50 p-3 text-sm">
              <p>
                完了 - インポート: {uploadResult.imported}件 / スキップ: {uploadResult.skipped}件 / 失敗: {uploadResult.failed}件
              </p>
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
