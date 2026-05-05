/**
 * V3.6 aggregates — pure-function unit tests.
 * Functions that hit prisma are not covered here; that's covered by integration
 * tests against the test DB (separate later session).
 */

import { describe, it, expect } from "vitest";
import {
  classifyRfm,
  computeAlerts,
  pickNarrative,
  pickRootCause,
  pickAction,
  renderSummary,
  generateScenarios,
  pastWeeklyRanges,
  type AlertContext,
  type NarrativeContext,
} from "../aggregates";

describe("classifyRfm", () => {
  it("classifies champion when recent + frequent + high spend", () => {
    expect(classifyRfm(15, 6, 8000)).toBe("champion");
  });

  it("classifies loyal when recent (<60d) + frequent (≥4) + spend ≥3000", () => {
    expect(classifyRfm(45, 4, 3500)).toBe("loyal");
  });

  it("classifies new customer when 30-89d + 1-3 visits (not at-risk threshold)", () => {
    // recencyDays=45 falls below atRisk's 60d gate → falls through to newCustomer
    expect(classifyRfm(45, 2, 600)).toBe("newCustomer");
  });

  it("classifies at-risk when 60-180d + 2+ visits", () => {
    expect(classifyRfm(120, 3, 2000)).toBe("atRisk");
  });

  it("classifies lost when >180d", () => {
    expect(classifyRfm(200, 5, 5000)).toBe("lost");
  });

  it("falls back to lost for one-shot recent", () => {
    expect(classifyRfm(45, 1, 100)).toBe("newCustomer");
  });
});

describe("computeAlerts", () => {
  const baseCtx: AlertContext = {
    yoyTrailing3M: 0,
    retention90: 60,
    prebookRate: 60,
    ticket: 800,
    ticket12mAvg: 800,
    monthlyActiveCustomers: 100,
    monthlyActivePrev: 100,
  };

  it("emits no alert when all KPIs healthy", () => {
    expect(computeAlerts(baseCtx)).toEqual([]);
  });

  it("emits red alert for YoY < -15%", () => {
    const alerts = computeAlerts({ ...baseCtx, yoyTrailing3M: -20 });
    expect(alerts.find((a) => a.id === "yoy_3m_red")).toBeDefined();
  });

  it("emits red alert for retention < 35%", () => {
    const alerts = computeAlerts({ ...baseCtx, retention90: 30 });
    expect(alerts.find((a) => a.id === "retention_red")).toBeDefined();
  });

  it("sorts red alerts before yellow", () => {
    const alerts = computeAlerts({
      ...baseCtx,
      retention90: 38,         // yellow
      prebookRate: 20,         // red
    });
    expect(alerts[0].level).toBe("red");
  });

  it("caps to 3 alerts max", () => {
    const alerts = computeAlerts({
      yoyTrailing3M: -25,
      retention90: 30,
      prebookRate: 25,
      ticket: 500,
      ticket12mAvg: 800,
      monthlyActiveCustomers: 50,
      monthlyActivePrev: 50,
    });
    expect(alerts.length).toBeLessThanOrEqual(3);
  });
});

describe("narrative engine", () => {
  const ctx = (overrides: Partial<NarrativeContext>): NarrativeContext => ({
    monthLabel: "2026-04",
    revenue: 130000,
    momChangePct: 5,
    yoyChangePct: 10,
    ticket: 800,
    ticket12mAvg: 800,
    retention90: 50,
    prebookRate: 50,
    chemicalShare: 30,
    chemicalShareLastMonth: 32,
    occupancy: 70,
    monthlyActive: 100,
    ...overrides,
  });

  it("picks healthy_growth for positive YoY + flat MoM", () => {
    expect(pickNarrative(ctx({ yoyChangePct: 8, momChangePct: 2 }))).toBe("healthy_growth");
  });

  it("picks new_high for YoY ≥ 20%", () => {
    expect(pickNarrative(ctx({ yoyChangePct: 25 }))).toBe("new_high");
  });

  it("picks declining for YoY < -10%", () => {
    expect(pickNarrative(ctx({ yoyChangePct: -15 }))).toBe("declining");
  });

  it("identifies chemical share drop as root cause when -3pp", () => {
    expect(
      pickRootCause(ctx({ chemicalShare: 25, chemicalShareLastMonth: 30 })),
    ).toBe("chemical_share_drop");
  });

  it("identifies new retention low when retention90 < 40", () => {
    expect(pickRootCause(ctx({ retention90: 35 }))).toBe("new_retention_low");
  });

  it("renders a non-empty markdown-bold summary", () => {
    const text = renderSummary(ctx({ yoyChangePct: -15 }));
    expect(text).toContain("**");
    expect(text).toContain("行動建議");
  });

  it("pickAction returns string for any narrative × cause", () => {
    expect(typeof pickAction("declining", "chemical_share_drop")).toBe("string");
    expect(typeof pickAction("new_high", "seasonal")).toBe("string");
  });
});

describe("generateScenarios", () => {
  const history = Array.from({ length: 12 }, (_, i) => ({
    month: `2025-${String(i + 1).padStart(2, "0")}`,
    revenue: 100000,
  }));

  it("generates 4 scenarios with conservative/flat/aggressive/custom keys", () => {
    const ss = generateScenarios(1200000, history, 2026);
    expect(ss.map((s) => s.key)).toEqual(["conservative", "flat", "aggressive", "custom"]);
  });

  it("recommended is exactly aggressive (V3.6 §10 Q5 修正)", () => {
    const ss = generateScenarios(1200000, history, 2026);
    expect(ss.filter((s) => s.recommended).map((s) => s.key)).toEqual(["aggressive"]);
  });

  it("aggressive multiplier is 1.10 (進取)", () => {
    const ss = generateScenarios(1200000, history, 2026);
    const a = ss.find((s) => s.key === "aggressive")!;
    expect(a.multiplier).toBe(1.1);
    expect(a.targetAnnual).toBe(1320000);
  });

  it("conservative is 0.95 (保守 — 持平守成 = ×0.95 per §10 Q5)", () => {
    const ss = generateScenarios(1200000, history, 2026);
    expect(ss.find((s) => s.key === "conservative")!.multiplier).toBe(0.95);
  });

  it("distributes monthly targets proportionally to history share", () => {
    const ss = generateScenarios(1200000, history, 2026);
    const a = ss.find((s) => s.key === "aggressive")!;
    // each month had equal 100k/1.2M = 8.33% share → target 1.32M × 8.33% = 110000
    expect(a.monthlyTargets["2026-01"]).toBe(110000);
  });
});

// ─── pastWeeklyRanges (V3.8 perf — B2 regression test) ──────────────────
//
// computeDailyView's 4-week median used to be a serial for-loop. The Promise.all
// refactor extracted the date-range builder into pastWeeklyRanges() so the math
// is testable in isolation. These tests lock in the *exact same* range output
// the serial loop produced, so a future refactor that drifts the offset (e.g.
// off-by-one on i, weekday mismatch, TZ regression) fails immediately.

describe("pastWeeklyRanges", () => {
  it("returns N entries in chronological-recent-first order (i=1 → 7 days ago)", () => {
    // 2026-04-30 (Thursday) — index 0 should be 2026-04-23, index 3 should be 2026-04-02
    const ranges = pastWeeklyRanges(2026, 4, 30, 4);
    expect(ranges).toHaveLength(4);

    // Each pStart is Taipei 00:00 (UTC -8h of that day). pEnd is Taipei 23:59:59.999.
    // 2026-04-23 Taipei midnight = 2026-04-22T16:00:00Z
    expect(ranges[0].pStart.toISOString()).toBe("2026-04-22T16:00:00.000Z");
    expect(ranges[0].pEnd.toISOString()).toBe("2026-04-23T15:59:59.999Z");

    // 2026-04-16 Taipei midnight = 2026-04-15T16:00:00Z
    expect(ranges[1].pStart.toISOString()).toBe("2026-04-15T16:00:00.000Z");

    // 2026-04-09
    expect(ranges[2].pStart.toISOString()).toBe("2026-04-08T16:00:00.000Z");

    // 2026-04-02
    expect(ranges[3].pStart.toISOString()).toBe("2026-04-01T16:00:00.000Z");
  });

  it("crosses month boundary correctly (April 5 → previous weeks land in March)", () => {
    const ranges = pastWeeklyRanges(2026, 4, 5, 4);
    // 2026-04-05 - 7 = 2026-03-29
    expect(ranges[0].pStart.toISOString()).toBe("2026-03-28T16:00:00.000Z");
    // 2026-04-05 - 28 = 2026-03-08
    expect(ranges[3].pStart.toISOString()).toBe("2026-03-07T16:00:00.000Z");
  });

  it("crosses year boundary (Jan 7 → previous weeks land in December previous year)", () => {
    const ranges = pastWeeklyRanges(2026, 1, 7, 4);
    // 2026-01-07 - 7 = 2025-12-31
    expect(ranges[0].pStart.toISOString()).toBe("2025-12-30T16:00:00.000Z");
    // 2026-01-07 - 28 = 2025-12-10
    expect(ranges[3].pStart.toISOString()).toBe("2025-12-09T16:00:00.000Z");
  });

  it("preserves weekday across all returned ranges", () => {
    // 2026-04-30 is a Thursday (UTC). All 4 prior ranges should also be Thursdays.
    const ranges = pastWeeklyRanges(2026, 4, 30, 4);
    for (const { pEnd } of ranges) {
      // pEnd is 23:59:59.999 UTC of the target day → getUTCDay() returns weekday (Thursday=4)
      expect(pEnd.getUTCDay()).toBe(4);
    }
  });

  it("respects requested count (N=1, N=8 work the same way)", () => {
    expect(pastWeeklyRanges(2026, 4, 30, 1)).toHaveLength(1);
    expect(pastWeeklyRanges(2026, 4, 30, 8)).toHaveLength(8);
  });

  it("parallel mapping preserves order — ranges[i] is always 7×(i+1) days ago", () => {
    // This is the key invariant the parallelized Promise.all relies on:
    // sameWeekdayRev[i] must correspond to weeklyRanges[i].
    const ranges = pastWeeklyRanges(2026, 4, 30, 4);
    const fakeQuery = ranges.map(({ pStart }, idx) => ({
      idx,
      day: pStart.toISOString().slice(0, 10),
    }));
    // After "parallel" map, indexes 0..3 must map to days 7,14,21,28 ago.
    expect(fakeQuery).toEqual([
      { idx: 0, day: "2026-04-22" }, // -7d (Taipei 00:00 UTC)
      { idx: 1, day: "2026-04-15" }, // -14d
      { idx: 2, day: "2026-04-08" }, // -21d
      { idx: 3, day: "2026-04-01" }, // -28d
    ]);
  });
});
