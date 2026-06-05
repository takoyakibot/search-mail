"use client";

type PaginationProps = {
  page: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
};

export function Pagination({ page, total, limit, onPageChange }: PaginationProps) {
  const totalPages = Math.ceil(total / limit);

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
      <p className="text-sm text-gray-600">
        全 {total} 件中 {(page - 1) * limit + 1}-{Math.min(page * limit, total)} 件
      </p>
      <div className="flex gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded px-3 py-1 text-sm hover:bg-gray-100 disabled:opacity-50"
        >
          前へ
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter((p) => Math.abs(p - page) <= 2 || p === 1 || p === totalPages)
          .map((p, i, arr) => (
            <span key={p}>
              {i > 0 && arr[i - 1] !== p - 1 && <span className="px-1 text-gray-400">...</span>}
              <button
                onClick={() => onPageChange(p)}
                className={`rounded px-3 py-1 text-sm ${
                  p === page ? "bg-blue-600 text-white" : "hover:bg-gray-100"
                }`}
              >
                {p}
              </button>
            </span>
          ))}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="rounded px-3 py-1 text-sm hover:bg-gray-100 disabled:opacity-50"
        >
          次へ
        </button>
      </div>
    </div>
  );
}
