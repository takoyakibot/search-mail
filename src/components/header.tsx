"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

type SyncStatus = "idle" | "syncing" | "done";

async function fetchConnectedProviders(): Promise<string[]> {
  try {
    const res = await fetch("/api/import/status");
    if (!res.ok) return [];
    const data = await res.json();
    return data.providers || [];
  } catch {
    return [];
  }
}

async function syncProvider(provider: "google" | "microsoft") {
  const endpoint =
    provider === "google" ? "/api/import/google/fetch" : "/api/import/microsoft/fetch";
  const tokenField = provider === "google" ? "pageToken" : "skipToken";

  let cursor: string | null = null;
  let totalImported = 0;
  let consecutiveSkipBatches = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const res: Response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [tokenField]: cursor }),
      });

      if (res.status === 401) return totalImported;
      if (!res.ok) break;

      const data = await res.json();
      totalImported += data.imported || 0;

      if ((data.imported || 0) === 0) {
        consecutiveSkipBatches++;
      } else {
        consecutiveSkipBatches = 0;
      }

      if (consecutiveSkipBatches >= 2) break;
      if (!data.hasMore) break;
      cursor = provider === "google" ? data.nextPageToken : data.skipToken;
    } catch {
      break;
    }
  }

  return totalImported;
}

function formatSyncTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function Header({ onNewMails }: { onNewMails?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const [email, setEmail] = useState<string>("");

  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [lastSync, setLastSync] = useState<string>("");
  const [syncMessage, setSyncMessage] = useState("");
  const hasRun = useRef(false);

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setEmail(user.email);
    });
    setLastSync(localStorage.getItem("mail_last_sync") || "");
  }, []);

  const runSync = useCallback(async () => {
    setSyncStatus("syncing");
    setSyncMessage("");

    const providers = await fetchConnectedProviders();
    if (providers.length === 0) {
      setSyncStatus("done");
      return;
    }

    let totalImported = 0;
    for (const provider of providers) {
      totalImported += await syncProvider(provider as "google" | "microsoft");
    }

    const now = new Date().toISOString();
    setLastSync(now);
    localStorage.setItem("mail_last_sync", now);

    if (totalImported > 0) {
      setSyncMessage(`${totalImported}件取得`);
      if (onNewMails) onNewMails();
    }
    setSyncStatus("done");
  }, [onNewMails]);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    runSync();
  }, [runSync]);

  const handleLogout = async () => {
    const supabase = createSupabaseBrowser();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const linkClass = (path: string) =>
    pathname === path || pathname.startsWith(path + "/")
      ? "font-medium text-blue-600"
      : "text-gray-600 hover:text-gray-900";

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
        <h1 className="text-xl font-bold text-gray-900">MailSort</h1>

        {/* 同期ステータス */}
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {syncStatus === "syncing" ? (
            <span className="text-blue-600">同期中...</span>
          ) : (
            <>
              <span>最終同期: {lastSync ? formatSyncTime(lastSync) : "未実行"}</span>
              {syncMessage && <span className="text-green-600">{syncMessage}</span>}
              <button
                onClick={runSync}
                className="rounded border border-gray-300 px-2 py-0.5 text-gray-600 hover:bg-gray-50"
              >
                同期
              </button>
            </>
          )}
        </div>

        <nav className="flex items-center gap-4 text-sm">
          <a href="/dashboard" className={linkClass("/dashboard")}>ダッシュボード</a>
          <a href="/import" className={linkClass("/import")}>インポート</a>
          <a href="/settings" className={linkClass("/settings")}>設定</a>
          <span className="text-gray-400">|</span>
          {email && <span className="text-gray-500">{email}</span>}
          <button onClick={handleLogout} className="text-gray-500 hover:text-gray-700">
            ログアウト
          </button>
        </nav>
      </div>
    </header>
  );
}
