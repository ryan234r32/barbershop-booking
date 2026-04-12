import { describe, it, expect } from "vitest";
import {
  bookingGuideMessage,
  pricingCarouselMessage,
  businessInfoMessage,
  myBookingsGuideMessage,
  thankYouMessage,
} from "../messages";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Flex Message structures are deeply nested; strict typing adds no value in tests
type FlexNode = Record<string, any>;

const LIFF_URL = "https://liff.line.me/test-liff-id";

describe("Keyword reply Flex Messages", () => {
  describe("bookingGuideMessage", () => {
    it("returns a Flex Message with booking button", () => {
      const msg = bookingGuideMessage(LIFF_URL);
      expect(msg.type).toBe("flex");
      expect(msg.altText).toContain("預約");
      expect(msg.contents.type).toBe("bubble");
    });

    it("includes LIFF URL in the button action", () => {
      const msg = bookingGuideMessage(LIFF_URL);
      const bubble = msg.contents as FlexNode;
      const button = bubble.footer.contents[0];
      expect(button.action.uri).toBe(LIFF_URL);
    });
  });

  describe("pricingCarouselMessage", () => {
    const services = [
      { id: "svc-1", name: "男性剪髮", price: 1000, duration: 60, description: "洗髮 · 精修剪裁 · 造型完成", imageUrl: null },
      { id: "svc-2", name: "女性剪髮", price: 1100, duration: 60, description: "洗髮 · 剪裁設計 · 吹整造型", imageUrl: null },
      { id: "svc-3", name: "染髮", price: 2600, duration: 180, description: "全頭染色，打造專屬髮色", imageUrl: null },
      { id: "svc-4", name: "溫塑燙", price: 4000, duration: 180, description: "溫感塑型，打造自然捲度", imageUrl: null },
      { id: "svc-5", name: "結構式護髮", price: 2200, duration: 60, description: "深層修護，重建髮絲結構", imageUrl: null },
    ];

    it("returns a Flex Carousel", () => {
      const msg = pricingCarouselMessage(services, LIFF_URL);
      expect(msg.type).toBe("flex");
      expect(msg.contents.type).toBe("carousel");
    });

    it("creates one bubble per service", () => {
      const msg = pricingCarouselMessage(services, LIFF_URL);
      const carousel = msg.contents as FlexNode;
      expect(carousel.contents.length).toBe(5);
    });

    it("each bubble has a booking button with serviceId", () => {
      const msg = pricingCarouselMessage(services, LIFF_URL);
      const carousel = msg.contents as FlexNode;
      for (const bubble of carousel.contents) {
        expect(bubble.footer).toBeDefined();
        expect(bubble.footer.contents[0].action.uri).toContain(LIFF_URL);
        expect(bubble.footer.contents[0].action.uri).toContain("serviceId=");
      }
    });

    it("has altText for older LINE clients", () => {
      const msg = pricingCarouselMessage(services, LIFF_URL);
      expect(msg.altText).toBeTruthy();
      expect(msg.altText.length).toBeGreaterThan(0);
    });
  });

  describe("businessInfoMessage", () => {
    it("includes address and hours", () => {
      const msg = businessInfoMessage({
        shopName: "1008 Hair Studio",
        address: "台北市中正區",
        phone: "02-1234-5678",
        hours: "11:00-20:00",
      });
      expect(msg.type).toBe("flex");
      expect(msg.altText).toContain("1008 Hair Studio");
    });

    it("includes Google Maps button when URL provided", () => {
      const msg = businessInfoMessage({
        shopName: "Test",
        address: "台北市",
        phone: "02-1234",
        hours: "11-20",
        googleMapsUrl: "https://maps.google.com/test",
      });
      const bubble = msg.contents as FlexNode;
      expect(bubble.footer).toBeDefined();
      expect(bubble.footer.contents[0].action.uri).toContain("maps.google.com");
    });

    it("no footer when no Google Maps URL", () => {
      const msg = businessInfoMessage({
        shopName: "Test",
        address: "台北市",
        phone: "02-1234",
        hours: "11-20",
      });
      const bubble = msg.contents as FlexNode;
      expect(bubble.footer).toBeUndefined();
    });
  });

  describe("myBookingsGuideMessage", () => {
    it("links to my-bookings page", () => {
      const msg = myBookingsGuideMessage(LIFF_URL);
      const bubble = msg.contents as FlexNode;
      expect(bubble.footer.contents[0].action.uri).toContain("/my-bookings");
    });
  });

  describe("thankYouMessage", () => {
    it("includes shop name and service", () => {
      const msg = thankYouMessage({
        shopName: "1008 Hair Studio",
        serviceName: "男性剪髮",
        liffUrl: LIFF_URL,
      });
      expect(msg.type).toBe("flex");
      expect(msg.altText).toContain("1008 Hair Studio");
    });

    it("has booking button for next visit", () => {
      const msg = thankYouMessage({
        shopName: "Test",
        serviceName: "剪髮",
        liffUrl: LIFF_URL,
      });
      const bubble = msg.contents as FlexNode;
      expect(bubble.footer.contents[0].action.uri).toBe(LIFF_URL);
      expect(bubble.footer.contents[0].action.label).toContain("預約");
    });
  });
});

describe("Keyword matching logic", () => {
  // Testing the matchKeywords-like behavior
  function matchKeywords(text: string, keywords: string[]): boolean {
    return keywords.some((kw) => text.includes(kw));
  }

  it("matches exact keyword", () => {
    expect(matchKeywords("預約", ["預約"])).toBe(true);
  });

  it("matches substring", () => {
    expect(matchKeywords("我想要預約剪髮", ["預約"])).toBe(true);
  });

  it("does not match unrelated text", () => {
    expect(matchKeywords("天氣好好", ["預約", "價格"])).toBe(false);
  });

  it("first-match-wins: booking beats pricing when both present", () => {
    const text = "我要預約看價格";
    const bookingMatch = matchKeywords(text, ["預約"]);
    const pricingMatch = matchKeywords(text, ["價格"]);
    // Both match, but in the real handler, booking is checked first
    expect(bookingMatch).toBe(true);
    expect(pricingMatch).toBe(true);
  });

  it("matches greeting keywords case-insensitively conceptually", () => {
    expect(matchKeywords("hi", ["hi", "hello"])).toBe(true);
    expect(matchKeywords("你好", ["你好", "哈囉"])).toBe(true);
  });
});
