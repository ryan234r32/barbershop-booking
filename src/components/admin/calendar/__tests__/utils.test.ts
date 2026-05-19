/**
 * V3.7 P3 (5/19) — Service+Variant display + total-price helpers.
 * Covers getBookingServicesLabel / getBookingServicesTotalPrice across:
 *   - new services[] source of truth (with + without variant.name)
 *   - multi-service joining
 *   - compact mode (abbreviations, variant suppressed)
 *   - legacy fallback to booking.service.name when services[] empty
 */
import { describe, it, expect } from "vitest";
import {
  getBookingServicesLabel,
  getBookingServicesTotalPrice,
  abbreviateService,
} from "../utils";
import type { Booking, BookingServiceItem } from "../types";

function makeServiceItem(
  partial: Partial<BookingServiceItem> & { name: string; price?: number },
): BookingServiceItem {
  return {
    id: partial.id ?? `bs-${partial.name}`,
    order: partial.order ?? 0,
    price: partial.price ?? 500,
    durationMin: partial.durationMin ?? 60,
    serviceId: partial.serviceId ?? `srv-${partial.name}`,
    service: { id: `srv-${partial.name}`, name: partial.name },
    variantId: partial.variantId ?? null,
    variant: partial.variant ?? null,
  };
}

// Minimal Booking shape — only the fields getBookingServicesLabel reads.
function bookingFromItems(
  legacy: { name: string; price: number; slotsNeeded?: number },
  items: BookingServiceItem[] | undefined,
): Pick<Booking, "service" | "services"> {
  return {
    service: { name: legacy.name, price: legacy.price, slotsNeeded: legacy.slotsNeeded ?? 1 },
    services: items,
  };
}

describe("getBookingServicesLabel — V3.7 P3 variant suffix", () => {
  it("single service, no variant → service name", () => {
    const b = bookingFromItems(
      { name: "剪髮", price: 500 },
      [makeServiceItem({ name: "剪髮" })],
    );
    expect(getBookingServicesLabel(b)).toBe("剪髮");
  });

  it("single service with variant → 'name・variant'", () => {
    const b = bookingFromItems(
      { name: "剪髮", price: 500 },
      [
        makeServiceItem({
          name: "剪髮",
          variantId: "v1",
          variant: { id: "v1", name: "男" },
        }),
      ],
    );
    expect(getBookingServicesLabel(b)).toBe("剪髮・男");
  });

  it("two services with variants → joined with ' + '", () => {
    const b = bookingFromItems(
      { name: "剪髮", price: 500 },
      [
        makeServiceItem({
          name: "剪髮",
          variantId: "v1",
          variant: { id: "v1", name: "男" },
        }),
        makeServiceItem({
          name: "全頭染",
          order: 1,
          variantId: "v2",
          variant: { id: "v2", name: "過胸" },
        }),
      ],
    );
    expect(getBookingServicesLabel(b)).toBe("剪髮・男 + 全頭染・過胸");
  });

  it("mixed: some with variant, some without", () => {
    const b = bookingFromItems(
      { name: "剪髮", price: 500 },
      [
        makeServiceItem({ name: "剪髮" }),
        makeServiceItem({
          name: "全頭染",
          order: 1,
          variantId: "v2",
          variant: { id: "v2", name: "過胸" },
        }),
      ],
    );
    expect(getBookingServicesLabel(b)).toBe("剪髮 + 全頭染・過胸");
  });

  it("custom separator override is respected", () => {
    const b = bookingFromItems(
      { name: "剪髮", price: 500 },
      [
        makeServiceItem({ name: "剪髮" }),
        makeServiceItem({ name: "燙髮", order: 1 }),
      ],
    );
    expect(getBookingServicesLabel(b, { separator: " / " })).toBe("剪髮 / 燙髮");
  });

  it("compact mode: abbreviations joined by '/', variant suppressed", () => {
    const b = bookingFromItems(
      { name: "剪髮", price: 500 },
      [
        makeServiceItem({
          name: "剪髮",
          variantId: "v1",
          variant: { id: "v1", name: "男" },
        }),
        makeServiceItem({
          name: "染髮",
          order: 1,
          variantId: "v2",
          variant: { id: "v2", name: "過胸" },
        }),
        makeServiceItem({ name: "護髮", order: 2 }),
      ],
    );
    expect(getBookingServicesLabel(b, { compact: true })).toBe("剪/染/護");
  });

  it("compact mode single service: 1-char abbreviation", () => {
    const b = bookingFromItems(
      { name: "剪髮", price: 500 },
      [makeServiceItem({ name: "剪髮" })],
    );
    expect(getBookingServicesLabel(b, { compact: true })).toBe("剪");
  });

  it("fallback to legacy booking.service.name when services[] is empty", () => {
    const b = bookingFromItems({ name: "剪髮", price: 500 }, []);
    expect(getBookingServicesLabel(b)).toBe("剪髮");
  });

  it("fallback to legacy booking.service.name when services[] is undefined", () => {
    const b = bookingFromItems({ name: "燙髮", price: 1500 }, undefined);
    expect(getBookingServicesLabel(b)).toBe("燙髮");
  });

  it("legacy fallback + compact mode → abbreviation", () => {
    const b = bookingFromItems({ name: "染髮", price: 2000 }, undefined);
    expect(getBookingServicesLabel(b, { compact: true })).toBe("染");
  });
});

describe("getBookingServicesTotalPrice — V3.7 P3", () => {
  it("sums prices across services[]", () => {
    const b = bookingFromItems(
      { name: "剪髮", price: 500 },
      [
        makeServiceItem({ name: "剪髮", price: 500 }),
        makeServiceItem({ name: "染髮", order: 1, price: 2000 }),
        makeServiceItem({ name: "護髮", order: 2, price: 800 }),
      ],
    );
    expect(getBookingServicesTotalPrice(b)).toBe(3300);
  });

  it("single service in services[]: returns that price (not legacy)", () => {
    const b = bookingFromItems(
      { name: "剪髮", price: 999 }, // legacy mismatch
      [makeServiceItem({ name: "剪髮", price: 500 })],
    );
    expect(getBookingServicesTotalPrice(b)).toBe(500);
  });

  it("falls back to legacy service.price when services[] empty", () => {
    const b = bookingFromItems({ name: "剪髮", price: 750 }, []);
    expect(getBookingServicesTotalPrice(b)).toBe(750);
  });

  it("falls back to legacy service.price when services[] undefined", () => {
    const b = bookingFromItems({ name: "剪髮", price: 750 }, undefined);
    expect(getBookingServicesTotalPrice(b)).toBe(750);
  });

  it("variant-priced rows: BookingService.price (already variant-resolved) is summed", () => {
    // BookingService.price is server-resolved from variant.price; helper just sums it.
    const b = bookingFromItems(
      { name: "剪髮", price: 500 },
      [
        makeServiceItem({
          name: "剪髮",
          price: 600, // variant 男 = 600
          variantId: "v1",
          variant: { id: "v1", name: "男" },
        }),
        makeServiceItem({
          name: "全頭染",
          order: 1,
          price: 3500, // variant 過胸 = 3500
          variantId: "v2",
          variant: { id: "v2", name: "過胸" },
        }),
      ],
    );
    expect(getBookingServicesTotalPrice(b)).toBe(4100);
  });
});

describe("abbreviateService — sanity (used by compact label)", () => {
  it("matches common service names to 1-char abbreviations", () => {
    expect(abbreviateService("剪髮")).toBe("剪");
    expect(abbreviateService("染髮")).toBe("染");
    expect(abbreviateService("補染")).toBe("染");
    expect(abbreviateService("燙髮")).toBe("燙");
    expect(abbreviateService("漂髮")).toBe("漂");
    expect(abbreviateService("護髮")).toBe("護");
  });
});
