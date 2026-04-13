import { formatTime, isWithinBusinessHours, nowTaipei } from "@/lib/utils/time";
import { DEFAULT_BUSINESS_HOURS } from "@/lib/utils/constants";
import { TIMEZONE } from "@/lib/utils/constants";

export interface CancellationPolicy {
  canCancelOnline: boolean;
  isViolation: boolean;
  reason: string;
  phoneNumber?: string;
}

/**
 * Determines cancellation policy for a booking.
 *
 * Rules (updated 2026-04-13):
 * - ≥ 24h before appointment: free online cancellation, no violation
 * - < 24h + during business hours: must call (show phone), NOT a violation if they call
 * - < 24h + outside business hours: cannot cancel online, show "call during business hours"
 * - Only No-show counts as a violation (handled separately, not here)
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
    bookingTime,
    currentTime = nowTaipei(),
    businessHoursStart = DEFAULT_BUSINESS_HOURS.startTime,
    businessHoursEnd = DEFAULT_BUSINESS_HOURS.endTime,
    shopPhone = "",
  } = params;

  // Calculate exact appointment datetime in Taipei timezone
  const bookingDateStr = bookingDate.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
  const [year, month, day] = bookingDateStr.split("-").map(Number);
  const [hour] = bookingTime.split(":").map(Number);
  const appointmentTime = new Date(Date.UTC(year, month - 1, day, hour - 8, 0, 0));

  const hoursUntil = (appointmentTime.getTime() - currentTime.getTime()) / (1000 * 60 * 60);

  // ≥ 24h before — free online cancellation
  if (hoursUntil >= 24) {
    return {
      canCancelOnline: true,
      isViolation: false,
      reason: "距離預約超過 24 小時，可免費取消",
    };
  }

  // < 24h — check if currently within business hours
  const currentTimeStr = formatTime(currentTime);
  const duringBusinessHours = isWithinBusinessHours(
    currentTimeStr,
    businessHoursStart,
    businessHoursEnd
  );

  if (duringBusinessHours) {
    // Must call during business hours
    return {
      canCancelOnline: false,
      isViolation: false,
      reason: "24 小時內的取消，請致電店家",
      phoneNumber: shopPhone,
    };
  }

  // Outside business hours — tell them to call during business hours
  return {
    canCancelOnline: false,
    isViolation: false,
    reason: `24 小時內的取消，請於營業時間（${businessHoursStart}-${businessHoursEnd}）致電店家`,
    phoneNumber: shopPhone,
  };
}
