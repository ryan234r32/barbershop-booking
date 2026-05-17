import { describe, it, expect } from "vitest";
import { rankAndRecommendSlots } from "@/lib/booking/smart-suggest";
import type { AvailableSlot } from "@/lib/booking/availability";

function makeSlot(startHour: number): AvailableSlot {
  const start = `${startHour.toString().padStart(2, "0")}:00`;
  const end = `${(startHour + 1).toString().padStart(2, "0")}:00`;
  return { startTime: start, endTime: end, isRecommended: false };
}

describe("rankAndRecommendSlots", () => {
  it("returns empty array when no available slots", () => {
    const result = rankAndRecommendSlots([], new Set(), 2);
    expect(result).toEqual([]);
  });

  it("recommends LATEST slots when no occupied slots exist (V3.7 evening-bias)", () => {
    const slots = [makeSlot(14), makeSlot(11), makeSlot(17)];
    const result = rankAndRecommendSlots(slots, new Set(), 2);

    const recommended = result.filter((s) => s.isRecommended);
    expect(recommended).toHaveLength(2);
    // V3.7 Tier 1.9: 17:00 (bonus +4) and 14:00 (bonus +1) recommended.
    // 11:00 has bonus 0 → not recommended.
    expect(recommended.map((s) => s.startTime).sort()).toEqual(["14:00", "17:00"]);
  });

  it("recommends slots adjacent to occupied slots", () => {
    // Occupied at 13:00. Slot at 14:00 is right after (score +10),
    // slot at 12:00 is right before (score +8).
    const slots = [makeSlot(11), makeSlot(12), makeSlot(14), makeSlot(17)];
    const occupied = new Set(["13:00"]);
    const result = rankAndRecommendSlots(slots, occupied, 2);

    const recommended = result.filter((s) => s.isRecommended);
    expect(recommended).toHaveLength(2);
    const times = recommended.map((s) => s.startTime);
    expect(times).toContain("14:00"); // right after occupied
    expect(times).toContain("12:00"); // right before occupied
  });

  it("respects maxRecommendations parameter", () => {
    const slots = [makeSlot(11), makeSlot(12), makeSlot(13), makeSlot(14)];
    const result1 = rankAndRecommendSlots(slots, new Set(), 1);
    expect(result1.filter((s) => s.isRecommended)).toHaveLength(1);

    const result3 = rankAndRecommendSlots(slots, new Set(), 3);
    expect(result3.filter((s) => s.isRecommended)).toHaveLength(3);
  });

  it("scores slot right after occupied higher than slot right before (V3.7)", () => {
    // V3.7 Tier 1.9 evening-bias:
    // Occupied at 17:00.
    // 18:00: after-bonus=10 + late-bonus=max(0,18-13)=5 = 15
    // 16:00: before-bonus=8 + late-bonus=max(0,16-13)=3 = 11
    const slots = [makeSlot(16), makeSlot(18)];
    const occupied = new Set(["17:00"]);
    const result = rankAndRecommendSlots(slots, occupied, 1);

    const recommended = result.filter((s) => s.isRecommended);
    expect(recommended).toHaveLength(1);
    expect(recommended[0].startTime).toBe("18:00"); // after-bonus + late-bonus 雙贏
  });

  it("returns all original slots (not just recommended ones)", () => {
    const slots = [makeSlot(11), makeSlot(12), makeSlot(13)];
    const result = rankAndRecommendSlots(slots, new Set(), 1);
    expect(result).toHaveLength(3);
    expect(result.filter((s) => s.isRecommended)).toHaveLength(1);
    expect(result.filter((s) => !s.isRecommended)).toHaveLength(2);
  });

  it("breaks score ties by LATER start time (V3.7 evening-bias)", () => {
    // V3.7 Tier 1.9: No occupied. Bonuses → 15:00=+2, 13:00=0, 11:00=0.
    // 15:00 wins on bonus; if all tied, latest time wins.
    const slots = [makeSlot(15), makeSlot(11), makeSlot(13)];
    const result = rankAndRecommendSlots(slots, new Set(), 1);

    const recommended = result.filter((s) => s.isRecommended);
    expect(recommended[0].startTime).toBe("15:00");
  });
});
