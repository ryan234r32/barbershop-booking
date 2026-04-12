"use client";

import { useState, useEffect, use, useRef } from "react";
import Image from "next/image";
import { useLiff } from "@/lib/liff/provider";
import { useToast } from "@/components/ui/toast";

interface BookingDetail {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  service: { name: string; price: number };
  tenant: { businessName: string; phone: string | null };
  payment: {
    status: string;
    method: string;
    screenshotUrl: string | null;
  } | null;
}

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()} (${WEEKDAYS[d.getDay()]})`;
}

type PaymentStep = 0 | 1 | 2;

function getPaymentStep(payment: BookingDetail["payment"]): PaymentStep {
  if (!payment || !payment.status) return 0;
  if (payment.status === "UPLOADED") return 1;
  if (payment.status === "RECEIVED") return 2;
  return 0;
}

export default function PaymentPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = use(params);
  const { isReady } = useLiff();
  const { toast } = useToast();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "transfer">("cash");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isReady) return;
    fetch(`/api/bookings/${bookingId}`)
      .then((r) => r.json())
      .then((data) => setBooking(data.booking))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isReady, bookingId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("bookingId", bookingId);

      const res = await fetch("/api/payments/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        toast({ message: data.error || "上傳失敗", type: "error" });
        setPreviewUrl(null);
        return;
      }

      setUploaded(true);
      toast({ message: "截圖已上傳，等待店家確認", type: "success" });

      // Refresh booking data
      const bookingRes = await fetch(`/api/bookings/${bookingId}`);
      const bookingData = await bookingRes.json();
      setBooking(bookingData.booking);
    } catch {
      toast({ message: "上傳失敗，請稍後再試", type: "error" });
      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  };

  const handleCopyAccount = async () => {
    try {
      await navigator.clipboard.writeText("123456789012");
      toast({ message: "已複製帳號", type: "success" });
    } catch {
      toast({ message: "複製失敗", type: "error" });
    }
  };

  const handleConfirmPayment = () => {
    if (paymentMethod === "cash") {
      toast({ message: "已選擇現金付款，到店時直接付款即可", type: "success" });
    } else if (paymentMethod === "transfer" && !uploaded && !booking?.payment?.screenshotUrl) {
      toast({ message: "請先上傳轉帳截圖", type: "info" });
    } else {
      toast({ message: "付款資訊已確認", type: "success" });
    }
  };

  // --- Loading ---
  if (!isReady || loading) {
    return (
      <div className="min-h-screen bg-[#FFF8F1] flex items-center justify-center" style={{ fontFamily: "'Manrope', 'Noto Sans TC', sans-serif" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-[#003D2B] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#003D2B]/50 font-medium">載入付款資訊...</p>
        </div>
      </div>
    );
  }

  // --- Not found ---
  if (!booking) {
    return (
      <div className="min-h-screen bg-[#FFF8F1] flex items-center justify-center" style={{ fontFamily: "'Manrope', 'Noto Sans TC', sans-serif" }}>
        <p className="text-[#003D2B]/40 text-sm font-medium">找不到預約</p>
      </div>
    );
  }

  const isPaid = booking.payment?.status === "RECEIVED";
  const paymentStep = getPaymentStep(booking.payment);
  const dateDisplay = `${formatDate(booking.date)} · ${booking.startTime} — ${booking.endTime}`;

  return (
    <div className="min-h-screen bg-[#FFF8F1]" style={{ fontFamily: "'Manrope', 'Noto Sans TC', sans-serif" }}>
      {/* Fixed header */}
      <header className="fixed top-0 w-full z-50 bg-[#FFF8F1]/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-6 h-16">
          <a
            href="/my-bookings"
            className="flex items-center gap-1 text-sm text-[#003D2B]/70 font-medium hover:text-[#003D2B] transition-colors"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            返回我的預約
          </a>
          <h1 className="text-lg font-bold text-[#003D2B] tracking-tight">付款</h1>
        </div>
      </header>

      {/* Main content */}
      <main className="pt-24 pb-32 px-6 max-w-md mx-auto">
        {/* Booking summary card */}
        <div className="bg-[#faf2ea] rounded-xl p-6 mb-10">
          <h2 className="text-xl font-bold text-[#003D2B] tracking-tight">
            {booking.service.name}
          </h2>
          <p className="text-[#404944]/70 text-sm mt-1">{dateDisplay}</p>

          <div className="mt-8 pt-6 border-t border-[#c0c9c2]/20">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[10px] tracking-[0.1em] font-medium text-[#404944]/60 uppercase">
                  應付金額
                </p>
                <p className="text-2xl font-extrabold text-[#003D2B] mt-1">
                  NT${booking.service.price.toLocaleString()}
                </p>
              </div>
              <span
                className={`text-[10px] font-bold tracking-wider px-2 py-1 rounded-sm ${
                  isPaid
                    ? "text-[#1a503c] bg-[#b7efd4]"
                    : "text-[#1a503c] bg-[#b7efd4]"
                }`}
              >
                {isPaid ? "已確認" : "待付款"}
              </span>
            </div>
          </div>
        </div>

        {/* Payment confirmed state */}
        {isPaid ? (
          <div className="flex flex-col items-center py-12 space-y-4">
            <div className="w-16 h-16 rounded-full bg-[#4A7C59]/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#4A7C59] text-3xl">check_circle</span>
            </div>
            <p className="text-lg font-bold text-[#003D2B]">已確認收款</p>
            <p className="text-sm text-[#404944]/60">感謝您的付款，期待為您服務</p>
          </div>
        ) : (
          <>
            {/* Payment method section */}
            <div className="space-y-8 mt-10">
              <h3 className="text-sm font-bold tracking-widest text-[#404944]/80 uppercase">
                選擇付款方式
              </h3>

              {/* Option A: Cash */}
              <label className="flex items-start gap-4 p-4 cursor-pointer">
                <input
                  type="radio"
                  name="payment-method"
                  checked={paymentMethod === "cash"}
                  onChange={() => setPaymentMethod("cash")}
                  className="w-5 h-5 mt-0.5 text-[#003D2B] border-[#707974] focus:ring-0 accent-[#003D2B]"
                />
                <div>
                  <p className="font-bold text-[#1e1b17]">到店現金付款</p>
                  <p className="text-sm text-[#404944]/60 mt-0.5">到店時直接付款即可</p>
                </div>
              </label>

              {/* Option B: Bank transfer */}
              <div>
                <label className="flex items-start gap-4 p-4 cursor-pointer">
                  <input
                    type="radio"
                    name="payment-method"
                    checked={paymentMethod === "transfer"}
                    onChange={() => setPaymentMethod("transfer")}
                    className="w-5 h-5 mt-0.5 text-[#003D2B] border-[#707974] focus:ring-0 accent-[#003D2B]"
                  />
                  <div>
                    <p className="font-bold text-[#1e1b17]">銀行轉帳</p>
                    <p className="text-sm text-[#404944]/60 mt-0.5">轉帳後上傳截圖</p>
                  </div>
                </label>

                {/* Expanded bank info */}
                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    paymentMethod === "transfer"
                      ? "max-h-[600px] opacity-100 mt-2"
                      : "max-h-0 opacity-0"
                  }`}
                >
                  {/* Bank details */}
                  <div className="ml-9 bg-[#faf2ea] rounded-xl p-5 space-y-3 border border-[#c0c9c2]/10">
                    <div className="flex justify-between">
                      <span className="text-[#404944]/60 text-sm">銀行</span>
                      <span className="text-[#1e1b17] font-medium text-sm">中國信託 (822)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#404944]/60 text-sm">戶名</span>
                      <span className="text-[#1e1b17] font-medium text-sm">陳先生</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#404944]/60 text-sm">帳號</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[#1e1b17] font-medium font-mono text-sm">
                          1234-5678-9012
                        </span>
                        <button
                          onClick={handleCopyAccount}
                          className="text-[10px] font-bold tracking-widest text-[#003D2B] border border-[#003D2B]/20 px-2 py-1 rounded hover:bg-[#003D2B]/5 transition-colors"
                        >
                          複製
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Upload zone */}
                  <div className="ml-9 mt-4">
                    {booking.payment?.screenshotUrl || uploaded ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-[#4A7C59]">
                          <span className="material-symbols-outlined text-lg">check_circle</span>
                          <span className="text-xs font-bold tracking-widest">已上傳</span>
                        </div>
                        {(previewUrl || booking.payment?.screenshotUrl) && (
                          <div className="relative w-full aspect-[3/4] rounded-xl overflow-hidden">
                            <Image
                              src={previewUrl || booking.payment?.screenshotUrl || ""}
                              alt="轉帳截圖"
                              fill
                              className="object-contain"
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full border-2 border-dashed border-[#003D2B]/20 rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-[#003D2B]/40 hover:bg-[#003D2B]/[0.02] transition-colors"
                      >
                        {uploading ? (
                          <>
                            <div className="w-6 h-6 border-2 border-[#003D2B] border-t-transparent rounded-full animate-spin" />
                            <span className="text-xs font-bold tracking-widest text-[#003D2B]/60">
                              上傳中...
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-[30px] text-[#003D2B]/40">
                              cloud_upload
                            </span>
                            <span className="text-xs font-bold tracking-widest text-[#003D2B]/60">
                              上傳轉帳截圖
                            </span>
                          </>
                        )}
                      </button>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleUpload}
                      disabled={uploading}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Confirm button */}
            <button
              onClick={handleConfirmPayment}
              className="w-full bg-[#003D2B] text-[#FFF8F1] py-4 font-bold tracking-widest text-sm rounded mt-12 hover:bg-[#003D2B]/90 transition-colors active:scale-[0.98]"
            >
              確認付款資訊
            </button>
          </>
        )}
      </main>

      {/* Payment timeline (fixed bottom) */}
      <div className="fixed bottom-0 w-full bg-[#FFF8F1] border-t-[1.5px] border-[#003D2B]/10 px-8 h-24 flex flex-col justify-center items-center">
        <div className="relative flex items-center justify-between w-full max-w-xs">
          {/* Background line */}
          <div className="absolute top-1/2 left-0 w-full h-[1.5px] bg-[#e8e1da] -translate-y-1/2 z-0" />
          {/* Progress line */}
          <div
            className="absolute top-1/2 left-0 h-[1.5px] bg-[#003D2B] -translate-y-1/2 z-0 transition-all duration-500"
            style={{
              width: paymentStep === 0 ? "0%" : paymentStep === 1 ? "50%" : "100%",
            }}
          />

          {/* Step 1: 上傳 */}
          <div className="relative z-10 flex flex-col items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full transition-colors ${
                paymentStep >= 1
                  ? "bg-[#003D2B]"
                  : paymentStep === 0
                    ? "border-2 border-[#003D2B] bg-[#FFF8F1]"
                    : "bg-[#e8e1da] opacity-40"
              }`}
            />
            <span
              className={`text-[10px] font-bold tracking-tighter ${
                paymentStep >= 0 ? "text-[#003D2B]" : "text-[#003D2B] opacity-40"
              }`}
            >
              上傳
            </span>
          </div>

          {/* Step 2: 店家確認中 */}
          <div className="relative z-10 flex flex-col items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full transition-colors ${
                paymentStep >= 2
                  ? "bg-[#003D2B]"
                  : paymentStep === 1
                    ? "border-2 border-[#003D2B] bg-[#FFF8F1]"
                    : "bg-[#e8e1da] opacity-40"
              }`}
            />
            <span
              className={`text-[10px] font-bold tracking-tighter ${
                paymentStep >= 1 ? "text-[#003D2B]" : "text-[#003D2B] opacity-40"
              }`}
            >
              店家確認中
            </span>
          </div>

          {/* Step 3: 已確認 */}
          <div className="relative z-10 flex flex-col items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full transition-colors ${
                paymentStep >= 2
                  ? "bg-[#003D2B]"
                  : "bg-[#e8e1da] opacity-40"
              }`}
            />
            <span
              className={`text-[10px] font-bold tracking-tighter ${
                paymentStep >= 2 ? "text-[#003D2B]" : "text-[#003D2B] opacity-40"
              }`}
            >
              已確認
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
