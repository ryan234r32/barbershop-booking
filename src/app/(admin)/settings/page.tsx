"use client";

import { useState, useEffect } from "react";

const WEEKDAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"];

interface BusinessHoursRow {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isOpen: boolean;
}

interface Holiday {
  id: string;
  date: string;
  reason: string | null;
}

export default function SettingsPage() {
  const [tenant, setTenant] = useState({
    businessName: "",
    phone: "",
    address: "",
    bankInfo: "",
    bankAccountName: "",
    bankAccountNumber: "",
  });
  const [businessHours, setBusinessHours] = useState<BusinessHoursRow[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [newHoliday, setNewHoliday] = useState({ date: "", reason: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/settings").then((r) => r.json()),
      fetch("/api/admin/holidays").then((r) => r.json()),
    ])
      .then(([settingsData, holidaysData]) => {
        if (settingsData.tenant) setTenant(settingsData.tenant);
        if (settingsData.businessHours) setBusinessHours(settingsData.businessHours);
        setHolidays(holidaysData.holidays || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant, businessHours }),
      });
      alert("設定已儲存");
    } catch {
      alert("儲存失敗");
    } finally {
      setSaving(false);
    }
  };

  const handleAddHoliday = async () => {
    if (!newHoliday.date) return;

    const res = await fetch("/api/admin/holidays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newHoliday),
    });

    if (res.ok) {
      const data = await res.json();
      setHolidays([...holidays, data.holiday]);
      setNewHoliday({ date: "", reason: "" });
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    await fetch(`/api/admin/holidays?id=${id}`, { method: "DELETE" });
    setHolidays(holidays.filter((h) => h.id !== id));
  };

  const updateBH = (idx: number, field: string, value: string | boolean) => {
    setBusinessHours((prev) =>
      prev.map((bh, i) => (i === idx ? { ...bh, [field]: value } : bh))
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">設定</h1>

      {/* Shop info */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">店家資訊</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500">店名</label>
            <input
              value={tenant.businessName}
              onChange={(e) => setTenant({ ...tenant, businessName: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">電話</label>
              <input
                value={tenant.phone}
                onChange={(e) => setTenant({ ...tenant, phone: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">地址</label>
              <input
                value={tenant.address}
                onChange={(e) => setTenant({ ...tenant, address: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Bank info */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">轉帳資訊</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500">銀行名稱</label>
            <input
              value={tenant.bankInfo}
              onChange={(e) => setTenant({ ...tenant, bankInfo: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="例：國泰世華 013"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">戶名</label>
              <input
                value={tenant.bankAccountName}
                onChange={(e) => setTenant({ ...tenant, bankAccountName: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">帳號</label>
              <input
                value={tenant.bankAccountNumber}
                onChange={(e) => setTenant({ ...tenant, bankAccountNumber: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Business hours */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">營業時間</h2>
        <div className="space-y-2">
          {businessHours
            .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
            .map((bh, idx) => (
              <div key={bh.dayOfWeek} className="flex items-center gap-3">
                <span className="w-8 text-sm font-medium text-gray-600">
                  {WEEKDAY_NAMES[bh.dayOfWeek]}
                </span>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={bh.isOpen}
                    onChange={(e) => updateBH(idx, "isOpen", e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-xs text-gray-500">營業</span>
                </label>
                {bh.isOpen && (
                  <>
                    <input
                      type="time"
                      value={bh.startTime}
                      onChange={(e) => updateBH(idx, "startTime", e.target.value)}
                      className="px-2 py-1 border rounded text-sm"
                    />
                    <span className="text-gray-400">-</span>
                    <input
                      type="time"
                      value={bh.endTime}
                      onChange={(e) => updateBH(idx, "endTime", e.target.value)}
                      className="px-2 py-1 border rounded text-sm"
                    />
                  </>
                )}
              </div>
            ))}
        </div>
      </section>

      {/* Holidays */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">假日設定</h2>
        <div className="flex gap-2 mb-4">
          <input
            type="date"
            value={newHoliday.date}
            onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
            className="px-3 py-2 border rounded-lg text-sm"
          />
          <input
            value={newHoliday.reason}
            onChange={(e) => setNewHoliday({ ...newHoliday, reason: e.target.value })}
            placeholder="原因（選填）"
            className="flex-1 px-3 py-2 border rounded-lg text-sm"
          />
          <button
            onClick={handleAddHoliday}
            className="px-3 py-2 bg-emerald-500 text-white rounded-lg text-sm"
          >
            新增
          </button>
        </div>
        {holidays.length > 0 && (
          <div className="space-y-1">
            {holidays.map((h) => (
              <div key={h.id} className="flex items-center justify-between text-sm py-1">
                <span>
                  {new Date(h.date).toLocaleDateString("zh-TW")}
                  {h.reason && ` — ${h.reason}`}
                </span>
                <button
                  onClick={() => handleDeleteHoliday(h.id)}
                  className="text-red-400 hover:text-red-600 text-xs"
                >
                  刪除
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className={`w-full py-3 rounded-xl font-medium text-white ${saving ? "bg-gray-400" : "bg-emerald-500 hover:bg-emerald-600"}`}
      >
        {saving ? "儲存中..." : "儲存所有設定"}
      </button>
    </div>
  );
}
