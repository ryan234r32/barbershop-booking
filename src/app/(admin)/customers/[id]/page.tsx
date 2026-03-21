"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";

interface CustomerDetail {
  id: string;
  displayName: string | null;
  realName: string | null;
  pictureUrl: string | null;
  phone: string | null;
  email: string | null;
  segment: string;
  isVip: boolean;
  violationCount: number;
  bookingRestricted: boolean;
  restrictedUntil: string | null;
  totalVisits: number;
  lastVisitAt: string | null;
  firstVisitAt: string | null;
  notes: string | null;
  tags: string[];
  createdAt: string;
  bookings: Array<{
    id: string;
    date: string;
    startTime: string;
    status: string;
    service: { name: string; price: number };
    payment: { status: string } | null;
    cancellation: { isViolation: boolean; reason: string | null } | null;
  }>;
}

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ realName: "", phone: "", notes: "" });

  useEffect(() => {
    fetch(`/api/customers/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setCustomer(data.customer);
        if (data.customer) {
          setForm({
            realName: data.customer.realName || "",
            phone: data.customer.phone || "",
            notes: data.customer.notes || "",
          });
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    const res = await fetch(`/api/customers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      const data = await res.json();
      setCustomer((prev) => prev ? { ...prev, ...data.customer } : prev);
      setEditing(false);
    }
  };

  const handleClearViolations = async () => {
    if (!confirm("確定要清除違規記錄嗎？")) return;

    const res = await fetch(`/api/customers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ violationCount: 0 }),
    });

    if (res.ok) {
      setCustomer((prev) =>
        prev ? { ...prev, violationCount: 0, bookingRestricted: false, restrictedUntil: null } : prev
      );
    }
  };

  const handleToggleVip = async () => {
    const res = await fetch(`/api/customers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isVip: !customer?.isVip }),
    });

    if (res.ok) {
      setCustomer((prev) => prev ? { ...prev, isVip: !prev.isVip } : prev);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!customer) {
    return <div className="text-gray-400">找不到顧客</div>;
  }

  return (
    <div className="max-w-2xl">
      <Link href="/customers" className="text-sm text-gray-500 mb-4 inline-block">
        ← 返回顧客列表
      </Link>

      {/* Profile header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <div className="flex items-start gap-4">
          {customer.pictureUrl ? (
            <img src={customer.pictureUrl} alt="" className="w-16 h-16 rounded-full" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-xl text-gray-500">
              {(customer.displayName || "?")[0]}
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">
                {customer.displayName || customer.realName || "未知顧客"}
              </h1>
              {customer.isVip && <span className="text-amber-500 text-lg">★ VIP</span>}
            </div>
            {customer.realName && customer.displayName && (
              <p className="text-sm text-gray-500">真實姓名：{customer.realName}</p>
            )}
            {customer.phone && <p className="text-sm text-gray-500">{customer.phone}</p>}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleToggleVip}
              className={`text-xs px-3 py-1.5 rounded-lg ${customer.isVip ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}`}
            >
              {customer.isVip ? "取消 VIP" : "設為 VIP"}
            </button>
            <button
              onClick={() => setEditing(!editing)}
              className="text-xs px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg"
            >
              {editing ? "取消" : "編輯"}
            </button>
          </div>
        </div>

        {/* Edit form */}
        {editing && (
          <div className="mt-4 space-y-3 border-t pt-4">
            <div className="grid grid-cols-2 gap-3">
              <input
                value={form.realName}
                onChange={(e) => setForm({ ...form, realName: e.target.value })}
                placeholder="真實姓名"
                className="px-3 py-2 border rounded-lg text-sm"
              />
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="電話"
                className="px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="備註"
              className="w-full px-3 py-2 border rounded-lg text-sm resize-none h-16"
            />
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm"
            >
              儲存
            </button>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-white rounded-xl border p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{customer.totalVisits}</p>
          <p className="text-xs text-gray-500">總來訪次數</p>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{customer.bookings.length}</p>
          <p className="text-xs text-gray-500">預約次數</p>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center">
          <p className={`text-2xl font-bold ${customer.violationCount > 0 ? "text-red-500" : "text-gray-900"}`}>
            {customer.violationCount}
          </p>
          <p className="text-xs text-gray-500">
            違規次數
            {customer.bookingRestricted && " (已限制)"}
          </p>
          {customer.violationCount > 0 && (
            <button
              onClick={handleClearViolations}
              className="text-xs text-emerald-600 mt-1"
            >
              清除
            </button>
          )}
        </div>
      </div>

      {/* Booking history */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold">預約紀錄</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {customer.bookings.map((b) => (
            <div key={b.id} className="px-6 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{b.service.name}</p>
                <p className="text-xs text-gray-500">
                  {new Date(b.date).toLocaleDateString("zh-TW")} {b.startTime}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-gray-400">{b.status}</span>
                {b.cancellation?.isViolation && (
                  <span className="block text-xs text-red-500">違規取消</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
