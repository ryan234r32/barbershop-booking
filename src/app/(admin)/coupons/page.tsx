"use client";

import { usePageTitle } from "@/lib/hooks/use-page-title";
import { ComingSoon } from "@/components/admin/coming-soon";

export default function CouponsPage() {
  usePageTitle("優惠券");

  return (
    <ComingSoon
      title="優惠券 A/B Test"
      prdSection="8"
      waveLabel="Wave 4c — 2026-Q3"
      description="客人 booking COMPLETED 後自動發優惠券（5% off / 95 折），系統把客戶分 A 組（30 天到期，急切型）vs B 組（45 天到期，理髮週期型）。3 個月後比較哪組回訪率高，再收斂到表現好的策略。"
      bullets={[
        "Coupon 列表 + 篩選（已用 / 未用 / 已過期）",
        "A/B test 即時 dashboard：兩組回訪率、過期率、總營收",
        "Emergency switches: 強制全 A / 全 B / 暫停發券（per-tenant flag）",
        "到期前 7 天自動 LINE 推播提醒",
        "客人 LIFF /my-coupons 看自己的券、預約時自動帶入折扣",
      ]}
    />
  );
}
