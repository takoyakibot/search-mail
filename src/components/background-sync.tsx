"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SyncStatus = "idle" | "syncing" | "done" | "no-token";

type SyncResult = {
  provider: string;
  imported: number;
  skipped: number;
};

async function syncProvider(
  provider: "google" | "microsoft",
): Promise<SyncResult> {
  const endpoint =
    provider === "google" ? "/api/import/google/fetch" : "/api/import/microsoft/fetch";
  const tokenField = provider === "google" ? "pageToken" : "skipToken";

  let cursor: string | null = null;
  let totalImported = 0;
  let totalSkipped = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const res: Response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [tokenField]: cursor }),
      });

      if (res.status === 401) {
        return { provider, imported: totalImported, skipped: totalSkipped };
      }

      if (!res.ok) break;

      const data = await res.json();
      totalImported += data.imported || 0;
      totalSkipped += data.skipped || 0;

      if (!data.hasMore) break;
      cursor = provider === "google" ? data.nextPageToken : data.skipToken;
    } catch {
      break;
    }
  }

  return { provider, imported: totalImported, skipped: totalSkipped };
}

function formatSyncTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function BackgroundSync({ onNewMails }: { onNewMails?: () => void }) {
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [lastSync, setLastSync] = useState<string>(() =>
    typeof window !== "undefined" ? localStorage.getItem("mail_last_sync") || "" : ""
  );
  const [message, setMessage] = useState("");
  const hasRun = useRef(false);

  const runSync = useCallback(async () => {
    setStatus("syncing");
    setMessage("");
    const allResults: SyncResult[] = [];

    const gmailResult = await syncProvider("google");
    if (gmailResult.imported > 0) allResults.push(gmailResult);

    const msResult = await syncProvider("microsoft");
    if (msResult.imported > 0) allResults.push(msResult);

    const now = new Date().toISOString();
    setLastSync(now);
    localStorage.setItem("mail_last_sync", now);

    if (allResults.length > 0) {
      const totalImported = allResults.reduce((sum, r) => sum + r.imported, 0);
      setMessage(`${totalImported}件の新着メールをインポートしました`);
      setStatus("done");
      if (onNewMails) onNewMails();
    } else {
      setStatus("done");
    }
  }, [onNewMails]);

  // 初回自動実行
  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    runSync();
  }, [runSync]);

  return (
    <div className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-4 py-2 text-sm">
      <div className="flex items-center gap-3">
        {status === "syncing" ? (
          <span className="text-blue-600">同期中...</span>
        ) : (
          <>
            <span className="text-gray-500">
              最終同期: {lastSync ? formatSyncTime(lastSync) : "未実行"}
            </span>
            {message && <span className="text-green-600">{message}</span>}
          </>
        )}
      </div>
      <button
        onClick={runSync}
        disabled={status === "syncing"}
        className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
      >
        {status === "syncing" ? "同期中..." : "今すぐ同期"}
      </button>
    </div>
  );
}
