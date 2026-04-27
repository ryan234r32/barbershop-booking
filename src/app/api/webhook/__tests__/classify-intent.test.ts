import { describe, it, expect } from "vitest";
import { classifyIntent, type KeywordIntent } from "../classify-intent";

describe("classifyIntent — table-driven keyword routing", () => {
  const cases: Array<{ input: string; expected: KeywordIntent; note?: string }> = [
    // my-bookings (highest priority — must beat "booking")
    { input: "我的預約", expected: "my-bookings" },
    { input: "查詢我的預約", expected: "my-bookings" },
    { input: "我預約了什麼", expected: "my-bookings", note: "contains 預約 but P1 beats P3" },
    { input: "我預約", expected: "my-bookings" },
    { input: "我約了", expected: "my-bookings" },
    { input: "紀錄", expected: "my-bookings" },
    { input: "記錄", expected: "my-bookings" },

    // cancel-reschedule (must also beat plain "booking")
    { input: "取消預約", expected: "cancel-reschedule" },
    { input: "我想改期", expected: "cancel-reschedule" },
    { input: "改時間", expected: "cancel-reschedule" },
    { input: "換時間", expected: "cancel-reschedule" },
    { input: "改一下", expected: "cancel-reschedule" },
    { input: "不約了", expected: "cancel-reschedule" },
    { input: "不來了", expected: "cancel-reschedule" },
    { input: "cancel my booking", expected: "cancel-reschedule" },

    // service inquiry — perm (Wave 1.7, 漂髮 NOT routed here per PRD §13.2)
    { input: "燙", expected: "service-inquiry-perm", note: "exact single-char trigger" },
    { input: "想燙", expected: "service-inquiry-perm" },
    { input: "我想燙頭髮", expected: "service-inquiry-perm" },
    { input: "燙髮多久", expected: "service-inquiry-perm" },
    { input: "要燙", expected: "service-inquiry-perm" },
    { input: "perm", expected: "service-inquiry-perm" },

    // service inquiry — color
    { input: "染", expected: "service-inquiry-color", note: "exact single-char trigger" },
    { input: "想染", expected: "service-inquiry-color" },
    { input: "我想染頭髮", expected: "service-inquiry-color" },
    { input: "染髮多少錢", expected: "service-inquiry-color", note: "service inquiry beats pricing — 染髮非固定價，需照片報價" },
    { input: "要染", expected: "service-inquiry-color" },
    { input: "color", expected: "service-inquiry-color" },

    // service inquiry — false positive guards (must NOT trigger)
    { input: "好燙", expected: "none" },
    { input: "燙手", expected: "none" },
    { input: "燙傷", expected: "none" },
    { input: "傳染", expected: "none" },
    { input: "汙染", expected: "none" },
    { input: "染色筆", expected: "none" },

    // booking
    { input: "預約", expected: "booking" },
    { input: "我要預約剪髮", expected: "booking" },
    { input: "訂位", expected: "booking" },
    { input: "約時間", expected: "booking" },
    { input: "I want to book", expected: "booking" },

    // pricing
    { input: "多少錢", expected: "pricing" },
    { input: "剪髮多少錢", expected: "pricing" },
    { input: "幾錢", expected: "pricing" },
    { input: "價格", expected: "pricing" },
    { input: "價目表", expected: "pricing" },
    { input: "收費標準", expected: "pricing" },
    { input: "費用", expected: "pricing" },
    { input: "服務項目", expected: "pricing" },

    // payment
    { input: "付款方式", expected: "payment" },
    { input: "轉帳", expected: "payment" },
    { input: "匯款", expected: "payment" },
    { input: "帳號", expected: "payment" },

    // payment sub-intents (Flex button → keyword routing)
    { input: "確定完成匯款", expected: "payment-confirm-done" },
    { input: "完成匯款", expected: "payment-confirm-done" },
    { input: "取消輸入末五碼", expected: "payment-cancel" },
    { input: "取消匯款", expected: "payment-cancel" },
    { input: "複製帳號", expected: "payment-copy-account" },
    { input: "複製金額", expected: "payment-copy-amount" },
    { input: "12345", expected: "payment-last5", note: "5 碼數字 → 末五碼回報" },
    { input: "00000", expected: "payment-last5" },
    { input: "1234", expected: "none", note: "4 碼不算" },
    { input: "123456", expected: "none", note: "6 碼不算" },
    { input: "12 345", expected: "none", note: "中間有空白不算" },

    // business-info
    { input: "營業時間", expected: "business-info" },
    { input: "幾點開", expected: "business-info" },
    { input: "週幾公休", expected: "business-info" },
    { input: "地址", expected: "business-info" },
    { input: "地點在哪裡", expected: "business-info" },
    { input: "位置", expected: "business-info" },
    { input: "在哪", expected: "business-info" },
    { input: "怎麼去", expected: "business-info" },
    { input: "怎麼走", expected: "business-info" },

    // phone
    { input: "電話幾號", expected: "phone" },
    { input: "手機", expected: "phone" },
    { input: "聯絡方式", expected: "phone" },
    { input: "打電話", expected: "phone" },

    // thanks
    { input: "謝謝", expected: "thanks" },
    { input: "感謝", expected: "thanks" },
    { input: "thanks!", expected: "thanks" },
    { input: "thank you", expected: "thanks" },

    // greeting
    { input: "你好", expected: "greeting" },
    { input: "哈囉", expected: "greeting" },
    { input: "hi", expected: "greeting" },
    { input: "hello", expected: "greeting" },
    { input: "嗨", expected: "greeting" },

    // no match → busy notice flow
    { input: "今天天氣真好", expected: "none" },
    { input: "老闆呢", expected: "none" },
    { input: "?", expected: "none" },
    { input: "🙂", expected: "none" },
    { input: "", expected: "none" },
  ];

  for (const { input, expected, note } of cases) {
    const label = note ? `"${input}" → ${expected} (${note})` : `"${input}" → ${expected}`;
    it(label, () => {
      expect(classifyIntent(input)).toBe(expected);
    });
  }
});

describe("classifyIntent — priority edge cases", () => {
  it("我的預約 beats 預約 (P1 > P3)", () => {
    expect(classifyIntent("我的預約")).toBe("my-bookings");
  });

  it("取消預約 beats 預約 (P2 > P3)", () => {
    expect(classifyIntent("取消預約")).toBe("cancel-reschedule");
  });

  it("is case-insensitive for English", () => {
    expect(classifyIntent("HELLO")).toBe("greeting");
    expect(classifyIntent("Book an appointment")).toBe("booking");
  });
});
