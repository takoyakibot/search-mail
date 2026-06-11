"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

function SocialLoginButtons() {
  const handleSocialLogin = async (provider: "google" | "azure") => {
    const supabase = createSupabaseBrowser();
    const redirectTo = `${window.location.origin}/auth/callback`;

    const scopes =
      provider === "google"
        ? "https://www.googleapis.com/auth/gmail.readonly"
        : "https://graph.microsoft.com/Mail.Read offline_access";

    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo, scopes },
    });
  };

  return (
    <>
      <div className="space-y-2">
        <button
          onClick={() => handleSocialLogin("google")}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Google で登録
        </button>
        <button
          onClick={() => handleSocialLogin("azure")}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Microsoft で登録
        </button>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-2 text-gray-400">または</span>
        </div>
      </div>
    </>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [tenantName, setTenantName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = createSupabaseBrowser();

      // 1. Supabase Auth でユーザー作成
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      if (!authData.user) {
        setError("ユーザーの作成に失敗しました");
        setLoading(false);
        return;
      }

      // 2. テナント作成 + プロフィール作成は API 経由
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: authData.user.id,
          tenantName,
          name,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "登録に失敗しました");
        setLoading(false);
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("登録中にエラーが発生しました");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-gray-200 bg-white p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">MailSort</h1>
          <p className="mt-1 text-sm text-gray-500">新規登録</p>
        </div>

        <SocialLoginButtons />

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label htmlFor="tenantName" className="block text-sm font-medium text-gray-700">
              会社名
            </label>
            <input
              id="tenantName"
              type="text"
              required
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              氏名
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              パスワード
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "登録中..." : "新規登録"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500">
          既にアカウントをお持ちの方は{" "}
          <Link href="/login" className="text-blue-600 hover:underline">
            ログイン
          </Link>
        </p>
      </div>
    </div>
  );
}
