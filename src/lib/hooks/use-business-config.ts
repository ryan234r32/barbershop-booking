"use client";

import useSWR from "swr";
import { MAX_ADVANCE_DAYS } from "@/lib/utils/constants";

export interface BusinessConfig {
  /** 最遠可預約天數，預設 45。 */
  maxAdvanceDays: number;
  /** 每週固定公休的星期數陣列（0=Sun..6=Sat），由 BusinessHours 推導。 */
  closedWeekdays: number[];
  /** 個別公休日（國定假日 / 臨時請假），YYYY-MM-DD。只回傳今天到 today+45 天的範圍。 */
  holidays: Array<{ date: string; reason: string | null }>;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/**
 * 客戶端 LIFF 日曆唯一資料來源。
 *
 * 為什麼存在：原本 calendar-step.tsx 寫死「30 天 + 週一公休」，跟資料庫脫節 —
 * admin 在 /settings 改了營業時間 / 假日，客戶看到的日曆不會跟著變。改用
 * 這個 hook 後，前後端共用 BusinessHours / Holiday 表 + MAX_ADVANCE_DAYS 常數。
 */
export function useBusinessConfig() {
  const { data, error, isLoading } = useSWR<BusinessConfig>(
    "/api/business-config",
    fetcher,
  );

  // Fallback：API 失敗時用安全預設值（最遠 45 天 / 沒有任何公休），讓客戶仍可
  // 操作日曆，但後端會在 POST /api/bookings 再次驗證攔住。
  const config: BusinessConfig = data ?? {
    maxAdvanceDays: MAX_ADVANCE_DAYS,
    closedWeekdays: [],
    holidays: [],
  };

  return { config, error, isLoading };
}
