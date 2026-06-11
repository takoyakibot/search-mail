"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { MailFilters } from "@/components/mail-filters";
import { MailList } from "@/components/mail-list";
import { Pagination } from "@/components/pagination";
import type { Database } from "@/types/database";

type Mail = Database["public"]["Tables"]["mails"]["Row"];

export default function DashboardPage() {
  const router = useRouter();
  const [mails, setMails] = useState<Mail[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const limit = 50;

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("");
  const [status, setStatus] = useState("");
  const [filtersLoaded, setFiltersLoaded] = useState(false);

  // localStorage から復元
  useEffect(() => {
    setQuery(localStorage.getItem("mail_q") || "");
    setCategory(localStorage.getItem("mail_cat") || "");
    setPriority(localStorage.getItem("mail_pri") || "");
    setStatus(localStorage.getItem("mail_st") || "");
    setFiltersLoaded(true);
  }, []);

  // localStorage に保存
  useEffect(() => {
    if (!filtersLoaded) return;
    localStorage.setItem("mail_q", query);
    localStorage.setItem("mail_cat", category);
    localStorage.setItem("mail_pri", priority);
    localStorage.setItem("mail_st", status);
  }, [filtersLoaded, query, category, priority, status]);

  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!filtersLoaded) return;
    setPage(1);
  }, [debouncedQuery, category, priority, status, filtersLoaded]);

  const fetchMails = useCallback(async () => {
    if (!filtersLoaded) return;
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (category) params.set("category", category);
    if (priority) params.set("priority", priority);
    if (status) params.set("status", status);

    try {
      const res = await fetch(`/api/mails?${params}`);
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      setMails(data.mails || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error("Failed to fetch mails:", error);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedQuery, category, priority, status, router, filtersLoaded]);

  useEffect(() => {
    fetchMails();
  }, [fetchMails]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await fetch(`/api/mails/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      setMails((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: newStatus } : m))
      );
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onNewMails={fetchMails} />

      <main className="mx-auto max-w-7xl space-y-4 px-4 py-6">
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <MailFilters
              query={query}
              category={category}
              priority={priority}
              status={status}
              onQueryChange={setQuery}
              onCategoryChange={setCategory}
              onPriorityChange={setPriority}
              onStatusChange={setStatus}
              onClear={() => { setQuery(""); setCategory(""); setPriority(""); setStatus(""); }}
            />
          </div>
          {!loading && (
            <div className="shrink-0 pb-4 text-sm text-gray-500">
              {total}件
            </div>
          )}
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-500">読み込み中...</div>
        ) : (
          <>
            <MailList mails={mails} onStatusChange={handleStatusChange} />
            <Pagination page={page} total={total} limit={limit} onPageChange={setPage} />
          </>
        )}
      </main>
    </div>
  );
}
