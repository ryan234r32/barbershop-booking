"use client";

import { useState, useEffect, use } from "react";
import { useLiff } from "@/lib/liff/provider";
import { LoadingSpinner } from "@/components/liff/loading-spinner";

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

export default function PaymentPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = use(params);
  const { isReady } = useLiff();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);

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
        alert(data.error || "上傳失敗");
        return;
      }

      setUploaded(true);
      // Refresh booking data
      const bookingRes = await fetch(`/api/bookings/${bookingId}`);
      const bookingData = await bookingRes.json();
      setBooking(bookingData.booking);
    } catch {
      alert("上傳失敗，請稍後再試");
    } finally {
      setUploading(false);
    }
  };

  if (!isReady || loading) return <LoadingSpinner message="載入付款資訊..." />;
  if (!booking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">找不到預約</p>
      </div>
    );
  }

  const isPaid = booking.payment?.status === "RECEIVED";

  return (
    <div className="max-w-md mx-auto p-4">
      <a
        href="/my-bookings"
        className="text-sm text-gray-500 mb-4 inline-flex items-center gap-1"
      >
        ← 返回我的預約
      </a>

      <h1 className="text-xl font-semibold mb-4">付款資訊</h1>

      {/* Booking summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <h3 className="font-medium mb-2">{booking.service.name}</h3>
        <div className="text-sm text-gray-500 space-y-1">
          <p>
            {new Date(booking.date).toLocaleDateString("zh-TW")} {booking.startTime} -{" "}
            {booking.endTime}
          </p>
          <p className="text-emerald-600 font-semibold text-lg">
            NT${booking.service.price.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Payment status */}
      {isPaid ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
          <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="font-medium text-emerald-700">已確認收款</p>
        </div>
      ) : (
        <>
          {/* Payment methods */}
          <div className="space-y-4">
            {/* Cash */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-medium mb-2">現金付款</h3>
              <p className="text-sm text-gray-500">
                到店時直接以現金支付即可。
              </p>
            </div>

            {/* Bank transfer */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-medium mb-2">銀行轉帳</h3>
              <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1 mb-3">
                <p className="text-gray-500">
                  轉帳完成後，請上傳截圖以便店家確認。
                </p>
              </div>

              {/* Upload area */}
              {booking.payment?.screenshotUrl ? (
                <div className="space-y-2">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700">
                    {uploaded ? "截圖已上傳，等待店家確認" : "已上傳轉帳截圖，等待確認中"}
                  </div>
                  <img
                    src={booking.payment.screenshotUrl}
                    alt="轉帳截圖"
                    className="w-full rounded-lg border"
                  />
                </div>
              ) : (
                <label className="block">
                  <div
                    className={`
                      border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors
                      ${uploading ? "border-gray-300 bg-gray-50" : "border-gray-300 hover:border-emerald-400 hover:bg-emerald-50"}
                    `}
                  >
                    {uploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm text-gray-500">上傳中...</span>
                      </div>
                    ) : (
                      <>
                        <svg
                          className="w-8 h-8 text-gray-400 mx-auto mb-2"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        <span className="text-sm text-gray-500">
                          點擊上傳轉帳截圖
                        </span>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleUpload}
                    disabled={uploading}
                  />
                </label>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
