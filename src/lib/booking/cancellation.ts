import { formatTime, isSameDay, isWithinBusinessHours, nowTaipei } from "@/lib/utils/time";
import { DEFAULT_BUSINESS_HOURS } from "@/lib/utils/constants";

export interface CancellationPolicy {
  canCancelOnline: boolean;
  isViolation: boolean;
  reason: string;
  phoneNumber?: string;
}

/**
 * Determines cancellation policy for a booking.
 *
 * Rules:
 * - Previous day or earlier: free cancellation, no violation
 * - Same day + during business hours: must call (show phone)
 * - Same day + after business hours: online OK but counts as violation
 */
export function getCancellationPolicy(params: {
  bookingDate: Date;
  bookingTime: string;
  currentTime?: Date;
  businessHoursStart?: string;
  businessHoursEnd?: string;
  shopPhone?: string;
}): CancellationPolicy {
  const {
    bookingDate,
    currentTime = nowTaipei(),
    businessHoursStart = DEFAULT_BUSINESS_HOURS.startTime,
    businessHoursEnd = DEFAULT_BUSINESS_HOURS.endTime,
    shopPhone = "",
  } = params;

  const isToday = isSameDay(bookingDate, currentTime);

  // Previous day or earlier — free cancellation
  if (!isToday) {
    return {
      canCancelOnline: true,
      isViolation: false,
      reason: "前一天取消，不收費用",
    };
  }

  // Same day — check if within business hours
  const currentTimeStr = formatTime(currentTime);
  const duringBusinessHours = isWithinBusinessHours(
    currentTimeStr,
    businessHoursStart,
    businessHoursEnd
  );

  if (duringBusinessHours) {
    // Must call — cannot cancel online
    return {
      canCancelOnline: false,
      isViolation: true,
      reason: "當天營業時間內取消，請致電店家",
      phoneNumber: shopPhone,
    };
  }

  // Same day, after business hours — online OK but violation
  return {
    canCancelOnline: true,
    isViolation: true,
    reason: "當天取消將記錄為一次違規",
  };
}
