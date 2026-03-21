import { AvailableSlot } from "./availability";
import { parseTimeToHour } from "@/lib/utils/time";

/**
 * Smart slot suggestion engine.
 *
 * Strategy: recommend slots that consolidate the barber's schedule,
 * prioritizing times adjacent to existing bookings to keep free blocks
 * contiguous. If no existing bookings, recommend earliest slots.
 *
 * Rules:
 * 1. Slots immediately after an existing booking → highest priority
 * 2. Slots immediately before an existing booking → second priority
 * 3. Earliest available → third priority (to front-load the day)
 * 4. Mark up to 2 recommended slots
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

    // Earlier in the day → slight bonus (max +5 for 11:00)
    score += Math.max(0, 5 - (startH - 11));

    return { slot, score };
  });

  // Sort by score descending, then by start time ascending for ties
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.slot.startTime.localeCompare(b.slot.startTime);
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
