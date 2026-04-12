"use client";

import { useState, useEffect } from "react";
import { usePageTitle } from "@/lib/hooks/use-page-title";

interface Service {
  id: string;
  name: string;
  description: string | null;
  duration: number;
  slotsNeeded: number;
  price: number;
  sortOrder: number;
  isActive: boolean;
}

export default function ServicesPage() {
  usePageTitle("服務項目管理");
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    duration: 60,
    slotsNeeded: 1,
    price: 500,
    sortOrder: 0,
  });

  const loadServices = () => {
    fetch("/api/services")
      .then((r) => r.json())
      .then((d) => setServices(d.services || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadServices();
  }, []);

  const resetForm = () => {
    setForm({ name: "", description: "", duration: 60, slotsNeeded: 1, price: 500, sortOrder: 0 });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const url = editingId ? `/api/services/${editingId}` : "/api/services";
    const method = editingId ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      resetForm();
      loadServices();
    } else {
      const data = await res.json();
      alert(data.error || "操作失敗");
    }
  };

  const handleEdit = (s: Service) => {
    setForm({
      name: s.name,
      description: s.description || "",
      duration: s.duration,
      slotsNeeded: s.slotsNeeded,
      price: s.price,
      sortOrder: s.sortOrder,
    });
    setEditingId(s.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("確定要停用此服務嗎？")) return;

    const res = await fetch(`/api/services/${id}`, { method: "DELETE" });
    if (res.ok) loadServices();
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">服務項目管理</h1>
        <button
          onClick={() => {
            resetForm();
            setShowForm(!showForm);
          }}
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary"
        >
          {showForm ? "取消" : "新增服務"}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-card rounded-xl border border-border p-4 mb-6 space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">名稱</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">價格 (NT$)</label>
              <input
                type="number"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: parseInt(e.target.value) || 0 })}
                required
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">描述</label>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">時長 (分鐘)</label>
              <input
                type="number"
                value={form.duration}
                onChange={(e) => setForm({ ...form, duration: parseInt(e.target.value) || 60 })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">佔用時段數</label>
              <input
                type="number"
                value={form.slotsNeeded}
                onChange={(e) => setForm({ ...form, slotsNeeded: parseInt(e.target.value) || 1 })}
                min={1}
                max={8}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">排序</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm"
          >
            {editingId ? "更新" : "新增"}
          </button>
        </form>
      )}

      {/* List */}
      <div className="bg-card rounded-xl border border-border">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">載入中...</div>
        ) : (
          <div className="divide-y divide-border/30">
            {services.map((s) => (
              <div key={s.id} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-foreground">{s.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {s.duration}分鐘 · {s.slotsNeeded}時段 · NT${s.price.toLocaleString()}
                  </p>
                  {s.description && (
                    <p className="text-xs text-muted-foreground">{s.description}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(s)}
                    className="text-xs px-2 py-1 text-primary hover:bg-primary/10 rounded"
                  >
                    編輯
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="text-xs px-2 py-1 text-destructive hover:bg-destructive/10 rounded"
                  >
                    停用
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
