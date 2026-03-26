"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePageTitle } from "@/lib/hooks/use-page-title";

interface Customer {
  id: string;
  displayName: string | null;
  realName: string | null;
  pictureUrl: string | null;
  phone: string | null;
  segment: string;
  isVip: boolean;
  violationCount: number;
  bookingRestricted: boolean;
  totalVisits: number;
  lastVisitAt: string | null;
  tags: string[];
  createdAt: string;
  _count: { bookings: number };
}

const SEGMENT_MAP: Record<string, { label: string; color: string }> = {
  NEW: { label: "新客", color: "bg-sky-100 text-sky-700" },
  REGULAR: { label: "常客", color: "bg-emerald-100 text-emerald-700" },
  VIP: { label: "VIP", color: "bg-amber-100 text-amber-700" },
  AT_RISK: { label: "流失風險", color: "bg-orange-100 text-orange-700" },
  LAPSED: { label: "已流失", color: "bg-red-100 text-red-700" },
  BLACKLISTED: { label: "黑名單", color: "bg-gray-800 text-white" },
};

export default function CustomersPage() {
  usePageTitle("顧客管理");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    startTransition(async () => {
      try {
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (segment) params.set("segment", segment);
        params.set("page", page.toString());

        const res = await fetch(`/api/customers?${params}`);
        const data = await res.json();
        setCustomers(data.customers || []);
        setTotal(data.total || 0);
      } catch (err) {
        console.error(err);
      }
    });
  }, [search, segment, page]);

  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">顧客管理</h1>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="搜尋姓名或電話..."
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-emerald-400"
        />
        <select
          value={segment}
          onChange={(e) => {
            setSegment(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-emerald-400"
        >
          <option value="">全部分類</option>
          {Object.entries(SEGMENT_MAP).map(([key, { label }]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Customer list */}
      <div className="bg-white rounded-xl border border-gray-200">
        {isPending ? (
          <div className="p-8 text-center text-gray-400">載入中...</div>
        ) : customers.length === 0 ? (
          <div className="p-8 text-center text-gray-400">沒有找到顧客</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
                <th className="px-4 py-3">顧客</th>
                <th className="px-4 py-3">分類</th>
                <th className="px-4 py-3">來訪次數</th>
                <th className="px-4 py-3">最近來訪</th>
                <th className="px-4 py-3">違規</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {customers.map((c) => {
                const seg = SEGMENT_MAP[c.segment] || { label: c.segment, color: "bg-gray-100" };
                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {c.pictureUrl ? (
                          <Image
                            src={c.pictureUrl}
                            alt=""
                            width={32}
                            height={32}
                            className="w-8 h-8 rounded-full"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-500">
                            {(c.displayName || c.realName || "?")[0]}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium">
                            {c.displayName || c.realName || "未知"}
                            {c.isVip && <span className="ml-1 text-amber-500">★</span>}
                          </p>
                          {c.phone && (
                            <p className="text-xs text-gray-400">{c.phone}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${seg.color}`}>
                        {seg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {c.totalVisits} 次
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {c.lastVisitAt
                        ? new Date(c.lastVisitAt).toLocaleDateString("zh-TW")
                        : "-"}
                    </td>
                    <td className="px-4 py-3">
                      {c.violationCount > 0 && (
                        <span className="text-xs text-red-500">
                          {c.violationCount} 次
                          {c.bookingRestricted && " (已限制)"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/customers/${c.id}`}
                        className="text-xs text-emerald-600 hover:underline"
                      >
                        查看
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm">
            <span className="text-gray-400">
              共 {total} 位顧客
            </span>
            <div className="flex gap-1">
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i + 1)}
                  className={`w-8 h-8 rounded ${page === i + 1 ? "bg-emerald-500 text-white" : "hover:bg-gray-100"}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
