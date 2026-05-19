"use client";

import { useState, useEffect } from "react";
import { usePageTitle } from "@/lib/hooks/use-page-title";

interface Variant {
  id: string;
  name: string;
  price: number;
  durationMin: number;
  slotsNeeded: number;
  sortOrder: number;
}

interface Service {
  id: string;
  name: string;
  description: string | null;
  duration: number;
  slotsNeeded: number;
  price: number;
  sortOrder: number;
  isActive: boolean;
  hasVariants: boolean;
  bookingMode: "NORMAL" | "CONSULTATION";
  variants: Variant[];
}

type ServiceForm = {
  name: string;
  description: string;
  duration: number;
  slotsNeeded: number;
  price: number;
  sortOrder: number;
  hasVariants: boolean;
  bookingMode: "NORMAL" | "CONSULTATION";
};

type VariantForm = {
  name: string;
  price: number;
  durationMin: number;
  sortOrder: number;
};

const EMPTY_SERVICE: ServiceForm = {
  name: "",
  description: "",
  duration: 60,
  slotsNeeded: 1,
  price: 500,
  sortOrder: 0,
  hasVariants: false,
  bookingMode: "NORMAL",
};

const EMPTY_VARIANT: VariantForm = {
  name: "",
  price: 1000,
  durationMin: 60,
  sortOrder: 0,
};

export default function ServicesPage() {
  usePageTitle("服務項目管理");
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ServiceForm>(EMPTY_SERVICE);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Variant modal state
  const [variantModal, setVariantModal] = useState<{
    serviceId: string;
    variantId: string | null;
    form: VariantForm;
  } | null>(null);

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
    setForm(EMPTY_SERVICE);
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side gate: hasVariants=true requires existing variants
    if (editingId && form.hasVariants) {
      const existing = services.find((s) => s.id === editingId);
      if (existing && existing.variants.length === 0) {
        alert("啟用變異前請先新增至少一個變異");
        return;
      }
    }
    if (!editingId && form.hasVariants) {
      alert("請先建立服務（不勾變異），存檔後展開新增變異，再回來勾「有變異」");
      return;
    }

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
      hasVariants: s.hasVariants,
      bookingMode: s.bookingMode,
    });
    setEditingId(s.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("確定要停用此服務嗎？")) return;

    const res = await fetch(`/api/services/${id}`, { method: "DELETE" });
    if (res.ok) loadServices();
  };

  // -------- Variant handlers --------
  const openNewVariant = (serviceId: string) => {
    setVariantModal({ serviceId, variantId: null, form: EMPTY_VARIANT });
  };

  const openEditVariant = (serviceId: string, v: Variant) => {
    setVariantModal({
      serviceId,
      variantId: v.id,
      form: {
        name: v.name,
        price: v.price,
        durationMin: v.durationMin,
        sortOrder: v.sortOrder,
      },
    });
  };

  const submitVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!variantModal) return;
    const { serviceId, variantId, form: vf } = variantModal;

    if (!vf.name.trim()) {
      alert("變異名稱必填");
      return;
    }
    if (vf.durationMin < 30 || vf.durationMin > 720) {
      alert("時數必須在 30-720 分鐘之間");
      return;
    }
    if (vf.price < 0 || vf.price > 100000) {
      alert("價格超出範圍");
      return;
    }

    const url = variantId
      ? `/api/services/${serviceId}/variants/${variantId}`
      : `/api/services/${serviceId}/variants`;
    const method = variantId ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(vf),
    });

    if (res.ok) {
      setVariantModal(null);
      loadServices();
    } else {
      const data = await res.json();
      alert(data.error || "操作失敗");
    }
  };

  const deleteVariant = async (serviceId: string, variantId: string) => {
    if (!confirm("確定要刪除此變異？若已有預約使用會改為停用。")) return;
    const res = await fetch(
      `/api/services/${serviceId}/variants/${variantId}`,
      { method: "DELETE" },
    );
    if (res.ok) loadServices();
    else {
      const data = await res.json();
      alert(data.error || "刪除失敗");
    }
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
              <label className="text-xs text-muted-foreground">
                預設價格 (NT$)
              </label>
              <input
                type="number"
                value={form.price}
                onChange={(e) =>
                  setForm({ ...form, price: parseInt(e.target.value) || 0 })
                }
                required
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">描述</label>
            <input
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">
                預設時長 (分鐘)
              </label>
              <input
                type="number"
                value={form.duration}
                onChange={(e) =>
                  setForm({
                    ...form,
                    duration: parseInt(e.target.value) || 60,
                  })
                }
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">
                預設佔用時段數
              </label>
              <input
                type="number"
                value={form.slotsNeeded}
                onChange={(e) =>
                  setForm({
                    ...form,
                    slotsNeeded: parseInt(e.target.value) || 1,
                  })
                }
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
                onChange={(e) =>
                  setForm({
                    ...form,
                    sortOrder: parseInt(e.target.value) || 0,
                  })
                }
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
          </div>

          {/* V3.7 P3 — hasVariants toggle + bookingMode radio */}
          <div className="border-t border-border/40 pt-3 space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.hasVariants}
                onChange={(e) =>
                  setForm({ ...form, hasVariants: e.target.checked })
                }
              />
              <span>有變異（不同價格/時數）</span>
              <span className="text-xs text-muted-foreground">
                — 啟用後預設價格/時長僅作 fallback，實際以變異為準
              </span>
            </label>

            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">預約模式</div>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="bookingMode"
                    checked={form.bookingMode === "NORMAL"}
                    onChange={() =>
                      setForm({ ...form, bookingMode: "NORMAL" })
                    }
                  />
                  正常（LIFF 可預約）
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="bookingMode"
                    checked={form.bookingMode === "CONSULTATION"}
                    onChange={() =>
                      setForm({ ...form, bookingMode: "CONSULTATION" })
                    }
                  />
                  諮詢制（不開放 LIFF 預約）
                </label>
              </div>
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
            {services.map((s) => {
              const isExpanded = expandedId === s.id;
              return (
                <div key={s.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-foreground flex items-center gap-2">
                        {s.name}
                        {s.hasVariants && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                            變異 ×{s.variants.length}
                          </span>
                        )}
                        {s.bookingMode === "CONSULTATION" && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                            諮詢制
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {s.duration}分鐘 · {s.slotsNeeded}時段 · NT$
                        {s.price.toLocaleString()}
                      </p>
                      {s.description && (
                        <p className="text-xs text-muted-foreground">
                          {s.description}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          setExpandedId(isExpanded ? null : s.id)
                        }
                        className="text-xs px-2 py-1 text-muted-foreground hover:bg-muted rounded"
                      >
                        {isExpanded ? "收合" : "變異"}
                      </button>
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

                  {/* Variants panel */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-border/30 space-y-2">
                      {s.variants.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          尚無變異
                        </p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead className="text-xs text-muted-foreground">
                            <tr className="text-left">
                              <th className="py-1 font-normal">名稱</th>
                              <th className="py-1 font-normal text-right">
                                價格
                              </th>
                              <th className="py-1 font-normal text-right">
                                時數
                              </th>
                              <th className="py-1 font-normal text-right">
                                時段
                              </th>
                              <th className="py-1 font-normal text-right">
                                排序
                              </th>
                              <th className="py-1 font-normal"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/20">
                            {s.variants.map((v) => (
                              <tr key={v.id}>
                                <td className="py-1.5">{v.name}</td>
                                <td className="py-1.5 text-right">
                                  NT${v.price.toLocaleString()}
                                </td>
                                <td className="py-1.5 text-right">
                                  {v.durationMin}分
                                </td>
                                <td className="py-1.5 text-right">
                                  {v.slotsNeeded}
                                </td>
                                <td className="py-1.5 text-right">
                                  {v.sortOrder}
                                </td>
                                <td className="py-1.5 text-right">
                                  <button
                                    onClick={() => openEditVariant(s.id, v)}
                                    className="text-xs px-2 py-0.5 text-primary hover:bg-primary/10 rounded"
                                  >
                                    編輯
                                  </button>
                                  <button
                                    onClick={() =>
                                      deleteVariant(s.id, v.id)
                                    }
                                    className="text-xs px-2 py-0.5 text-destructive hover:bg-destructive/10 rounded"
                                  >
                                    刪除
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}

                      <button
                        onClick={() => openNewVariant(s.id)}
                        className="text-xs px-3 py-1.5 bg-primary/10 text-primary rounded hover:bg-primary/20"
                      >
                        + 新增變異
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Variant modal */}
      {variantModal && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4"
          onClick={() => setVariantModal(null)}
        >
          <form
            onSubmit={submitVariant}
            onClick={(e) => e.stopPropagation()}
            className="bg-card w-full max-w-md rounded-xl border border-border p-4 space-y-3"
          >
            <h2 className="text-lg font-bold text-foreground">
              {variantModal.variantId ? "編輯變異" : "新增變異"}
            </h2>

            <div>
              <label className="text-xs text-muted-foreground">
                名稱（1-20 字）
              </label>
              <input
                value={variantModal.form.name}
                onChange={(e) =>
                  setVariantModal({
                    ...variantModal,
                    form: { ...variantModal.form, name: e.target.value },
                  })
                }
                maxLength={20}
                required
                placeholder="基本 / 過胸 / 過腰"
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">
                  價格 (NT$)
                </label>
                <input
                  type="number"
                  value={variantModal.form.price}
                  onChange={(e) =>
                    setVariantModal({
                      ...variantModal,
                      form: {
                        ...variantModal.form,
                        price: parseInt(e.target.value) || 0,
                      },
                    })
                  }
                  min={0}
                  max={100000}
                  required
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">
                  時數 (分鐘)
                </label>
                <input
                  type="number"
                  value={variantModal.form.durationMin}
                  onChange={(e) =>
                    setVariantModal({
                      ...variantModal,
                      form: {
                        ...variantModal.form,
                        durationMin: parseInt(e.target.value) || 60,
                      },
                    })
                  }
                  min={30}
                  max={720}
                  step={30}
                  required
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  時段數 = ceil({variantModal.form.durationMin || 0}/60) ={" "}
                  {Math.ceil((variantModal.form.durationMin || 0) / 60)}
                </p>
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">排序</label>
              <input
                type="number"
                value={variantModal.form.sortOrder}
                onChange={(e) =>
                  setVariantModal({
                    ...variantModal,
                    form: {
                      ...variantModal.form,
                      sortOrder: parseInt(e.target.value) || 0,
                    },
                  })
                }
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setVariantModal(null)}
                className="px-4 py-2 text-sm rounded-lg border border-border"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm"
              >
                {variantModal.variantId ? "更新" : "新增"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
