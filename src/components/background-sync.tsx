"use client";

import { useEffect, useRef, useState } from "react";

type SyncStatus = "idle" | "syncing" | "done" | "no-token";

type SyncResult = {
  provider: string;
  imported: number;
  skipped: number;
};

async function syncProvider(
  provider: "google" | "microsoft",
  onProgress: (imported: number, skipped: number) => void
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
        // トークンなし or 期限切れ
        return { provider, imported: totalImported, skipped: totalSkipped };
      }

      if (!res.ok) break;

      const data = await res.json();
      totalImported += data.imported || 0;
      totalSkipped += data.skipped || 0;
      onProgress(totalImported, totalSkipped);

      if (!data.hasMore) break;
      cursor = provider === "google" ? data.nextPageToken : data.skipToken;
    } catch {
      break;
    }
  }

  return { provider, imported: totalImported, skipped: totalSkipped };
}

export function BackgroundSync({ onNewMails }: { onNewMails?: () => void }) {
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [results, setResults] = useState<SyncResult[]>([]);
  const [current, setCurrent] = useState("");
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    (async () => {
      setStatus("syncing");
      const allResults: SyncResult[] = [];

      // Gmail
      setCurrent("Gmail");
      const gmailResult = await syncProvider("google", () => {});
      if (gmailResult.imported > 0) allResults.push(gmailResult);

      // Microsoft
      setCurrent("Microsoft");
      const msResult = await syncProvider("microsoft", () => {});
      if (msResult.imported > 0) allResults.push(msResult);

      setResults(allResults);
      setStatus(allResults.length > 0 ? "done" : "no-token");

      if (allResults.some((r) => r.imported > 0) && onNewMails) {
        onNewMails();
      }
    })();
  }, [onNewMails]);

  if (status === "idle" || status === "no-token") return null;

  if (status === "syncing") {
    return (
      <div className="rounded-md bg-blue-50 px-4 py-2 text-sm text-blue-700">
        {current} のメールを同期中...
      </div>
    );
  }

  if (status === "done" && results.length > 0) {
    const totalImported = results.reduce((sum, r) => sum + r.imported, 0);
    return (
      <div className="rounded-md bg-green-50 px-4 py-2 text-sm text-green-700">
        {totalImported}件の新着メールをインポートしました
      </div>
    );
  }

  return null;
}
