"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setEmail(user.email);
    });
  }, []);

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
