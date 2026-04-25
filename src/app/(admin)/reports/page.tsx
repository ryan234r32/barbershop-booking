"use client";

import { usePageTitle } from "@/lib/hooks/use-page-title";
import { ComingSoon } from "@/components/admin/coming-soon";

export default function ReportsPage() {
  usePageTitle("報表");

  return (
    <ComingSoon
      title="報表"
      prdSection="10.2"
      waveLabel="Wave 5 — 2026-Q3/Q4"
      description="把過去一年 Excel 資料 + 系統內預約整合成 8 個報表 widget，老闆從手機看 「店裡發生什麼事」。資料來源：1) 系統內 V3 預約；2) Wave 3.B Excel 匯入的 2025 全年歷史資料。"
      bullets={[
        "📊 月營收 + 同期比較（YoY / MoM）",
        "🕐 時段熱力圖（11-20 點 × 7 天，看哪些時段冷）",
        "🥧 服務分布 pie（剪 / 燙 / 染 / 漂佔比）",
        "👥 客戶分層（NEW / REGULAR / VIP / AT_RISK / LAPSED 圓環）",
        "📉 流失趨勢線（每月 LAPSED 變化）",
        "💰 客單價趨勢 + 高毛利占比",
        "🔁 回訪率（30/60/90 天 cohort）",
        "⏰ 取消 / 改期 / no-show 比例（看品質指標）",
      ]}
    />
  );
}
