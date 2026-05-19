import { z } from "zod";

export const createBookingSchema = z.object({
  tenantId: z.string().uuid().optional(),
  // V3.7 P3 (5/19) — 服務多選 + variant 支援。三個 input shapes，server 自動 normalize:
  //   1. `services: [{ serviceId, variantId? }]` ← preferred, new code path
  //   2. `serviceIds: uuid[]` ← legacy multi-service (no variants)
  //   3. `serviceId: uuid` ← legacy single
  // primary 服務（陣列第 0 個）寫到 legacy `Booking.serviceId` 維持 dual-write。
  serviceId: z.string().uuid().optional(),
  serviceIds: z.array(z.string().uuid()).min(1).max(8).optional(),
  services: z
    .array(
      z.object({
        serviceId: z.string().uuid(),
        variantId: z.string().uuid().optional(),
        /** V3.7 P3 (5/19) — 老闆現場決定的價錢/時數 override，特別給染漂諮詢制。
         *  不提供時 server 用 variant > service default 解析。允許任何服務使用。 */
        overridePrice: z.number().int().min(0).max(100000).optional(),
        overrideDurationMin: z.number().int().min(15).max(720).optional(),
      }),
    )
    .min(1)
    .max(8)
    .optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // V3.7 Tier 1.4 §0a E-E: admin 手動預約可用 HH:30（染燙漂常需 2.5/4.5hr），
  // 顧客 LIFF 仍維持 HH:00。Server-side 路徑 check auth.type === "admin"
  // 才接受 HH:30；LIFF call 即使送 HH:30 也會被 bookings/route.ts 攔下。
  // (slot 模型仍 1hr 為單位，HH:30 純粹是允許 start time 偏移半小時。)
  startTime: z.string().regex(/^\d{2}:(00|30)$/),
  // lineUserId is no longer accepted from the body — it is derived from the
  // authenticated caller (admin cookie or LIFF ID token). See booking-auth.ts.
  // Kept optional here for backwards compatibility with old clients; ignored.
  lineUserId: z.string().optional(),
  // customerId — admin-only path. When admin manually books for an existing
  // customer (picked from suggestions), pass user.id so we link the booking
  // to that user instead of creating a fresh "manual-{adminId}-{uuid}" ghost.
  // Server validates the user belongs to the same tenant before linking.
  // LIFF callers ignore this field entirely (identity comes from token).
  customerId: z.string().optional(),
  notes: z.string().optional(),
  realName: z.string().optional(),
  displayName: z.string().optional(),
  phone: z.string().optional(),
  birthday: z.string().optional(), // "YYYY-MM-DD" format from LIFF/admin profile gate
  gender: z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]).optional(),
  source: z.enum(["LIFF", "PHONE", "WALK_IN"]).optional(),
}).refine(
  (data) =>
    !!data.serviceId ||
    !!(data.serviceIds && data.serviceIds.length) ||
    !!(data.services && data.services.length),
  {
    message: "serviceId, serviceIds, or services is required",
    path: ["services"],
  },
);

/** V3.7 Tier 0.2 — Admin manual add-service after booking created.
 *  V3.7 P3 (5/19): variantId optional for services with variants. */
export const addBookingServiceSchema = z.object({
  serviceId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  expectedUpdatedAt: z.string().datetime().optional(),
});

export const cancelBookingSchema = z.object({
  reason: z.string().optional(),
});

export const updateProfileSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^09\d{8}$|^0\d{1,2}-?\d{6,8}$/, "電話格式不正確（例：0912345678）")
    .optional()
    .or(z.literal("")),
  birthday: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "生日格式須為 YYYY-MM-DD")
    .optional()
    .or(z.literal("")),
  gender: z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]).optional(),
  realName: z.string().trim().max(40).optional().or(z.literal("")),
  legacyName: z.string().trim().max(40).optional().or(z.literal("")),
});

export const rescheduleBookingSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:00$/),
  /** OCC token — client passes the booking's last-seen updatedAt so the server
   *  can reject the write if the row moved (e.g. customer cancelled while the
   *  admin was dragging). 409 + code "stale_write" on mismatch. */
  expectedUpdatedAt: z.string().datetime().optional(),
});

/** PATCH /api/bookings/[id] body — cancel / complete / no-show / admin_cancel.
 *  OCC is enforced on cancel + admin_cancel (the destructive transitions); the
 *  other actions remain idempotent state machines.
 *  See audit script: scripts/audit-booking-validation.sh */
export const patchBookingSchema = z.object({
  action: z.enum(["cancel", "complete", "no_show", "admin_cancel"]),
  reason: z.string().optional(),
  paymentMethod: z.string().optional(),
  /** Optional OCC fence (recommended for cancel / admin_cancel). */
  expectedUpdatedAt: z.string().datetime().optional(),
});

/** PATCH /api/bookings/[id]/settle body — optional OCC fence. */
export const settleBookingSchema = z.object({
  expectedUpdatedAt: z.string().datetime().optional(),
});

export const createServiceSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().optional(),
  duration: z.number().int().min(30).max(480),
  slotsNeeded: z.number().int().min(1).max(8),
  price: z.number().int().min(0),
  sortOrder: z.number().int().optional(),
  // V3.7 P3 (5/19) — admin can toggle variant mode + consultation mode
  hasVariants: z.boolean().optional(),
  bookingMode: z.enum(["NORMAL", "CONSULTATION"]).optional(),
});

// V3.7 P3 (5/19) — ServiceVariant CRUD schemas
export const createVariantSchema = z.object({
  name: z.string().trim().min(1).max(20),
  price: z.number().int().min(0).max(100000),
  durationMin: z.number().int().min(30).max(720),
  sortOrder: z.number().int().optional(),
});

export const updateVariantSchema = createVariantSchema.partial();

export const updateSettingsSchema = z.object({
  businessName: z.string().min(1).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  bankInfo: z.string().optional(),
  bankAccountName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
});

export const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

// 2026-04-27: reportTransferSchema 已移除 — LIFF /payment 頁刪除後，5 碼回報
// 改在 LINE webhook 用 regex /^\d{5}$/ 直接 inline classify。

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;
export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
