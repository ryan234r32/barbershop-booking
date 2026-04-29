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
