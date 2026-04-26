"use client";

import { usePageTitle } from "@/lib/hooks/use-page-title";
import { ComingSoon } from "@/components/admin/coming-soon";

export default function ConsultationsPage() {
  usePageTitle("諮詢請求");

  return (
    <ComingSoon
      title="諮詢請求"
      prdSection="3"
      waveLabel="Wave 4a — 2026-Q3"
      description="客戶在 LINE 打「漂」或第一次的服務（45 天外客）會建立諮詢請求而非直接預約。你會在這頁看到客戶上傳的現況照片、目標造型、上次染燙時間，可選擇回覆 LINE 或轉成正式預約。"
      bullets={[
        "待回覆隊列（紅點通知，priority desc）",
        "客戶資訊 + 上傳照片（現況 / 目標）+ 備註",
        "「回覆 LINE」一鍵跳到對話",
        "「轉預約」自動帶入客戶 + 服務 + 選時段建 Booking",
        "已回覆 / 已轉預約 / 已封存 三狀態管理",
      ]}
    />
  );
}
