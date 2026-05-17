import { AvailableSlot } from "./availability";
import { parseTimeToHour } from "@/lib/utils/time";

/**
 * Smart slot suggestion engine.
 *
 * V3.7 Tier 1.9 (autoplan + 訪談 §11) — Strategy CHANGED:
 *   舊版偏好 EARLY slots（11-13 點 +5 bonus）。
 *   新版偏好 LATE slots — 老闆希望早段陪家人，引導客人約晚段 (16+)。
 *
 * Rules:
 * 1. Slots immediately after an existing booking → highest priority (+10)
 *    (合併排班，讓老闆連續忙完一段)
 * 2. Slots immediately before an existing booking → second priority (+8)
 * 3. LATER in the day → slight bonus（取代舊的 early bonus）
 *    18:00 = +5, 17:00 = +4, 16:00 = +3, 15:00 = +2, 14:00 = +1, ≤13:00 = 0
 * 4. Mark up to 2 recommended slots
 * 5. Tie-break: LATER start time wins (反映「晚段優先」原則)
 */
export function rankAndRecommendSlots(
  available: AvailableSlot[],
  occupiedSlotTimes: Set<string>,
  maxRecommendations = 2
): AvailableSlot[] {
  if (available.length === 0) return [];

  // Score each slot
  const scored = available.map((slot) => {
    const startH = parseTimeToHour(slot.startTime);
    const endH = parseTimeToHour(slot.endTime);
    let score = 0;

    // Check if slot is adjacent to an occupied slot
    const prevSlot = `${(startH - 1).toString().padStart(2, "0")}:00`;
    const nextSlot = `${endH.toString().padStart(2, "0")}:00`;

    // Right after an existing booking → +10
    if (occupiedSlotTimes.has(prevSlot)) {
      score += 10;
    }

    // Right before an existing booking → +8
    if (occupiedSlotTimes.has(nextSlot)) {
      score += 8;
    }

    // V3.7 Tier 1.9: LATER in the day → slight bonus.
    // 18:00 = max(0, 18-13) = 5; 13:00 = 0; 11:00 = 0.
    score += Math.max(0, startH - 13);

    return { slot, score };
  });

  // V3.7 Tier 1.9: Sort by score desc, ties broken by LATER start time.
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.slot.startTime.localeCompare(a.slot.startTime);
  });

  // Reset all recommendations
  for (const item of available) {
    item.isRecommended = false;
  }

  // Mark top N as recommended
  const recommended = new Set<string>();
  for (const item of scored) {
    if (recommended.size >= maxRecommendations) break;
    recommended.add(item.slot.startTime);
  }

  // Apply recommendations back to original order
  for (const slot of available) {
    slot.isRecommended = recommended.has(slot.startTime);
  }

  return available;
}
