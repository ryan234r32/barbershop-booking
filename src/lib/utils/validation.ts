import { z } from "zod";

export const createBookingSchema = z.object({
  tenantId: z.string().uuid().optional(),
  serviceId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:00$/),
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
  birthday: z.string().optional(), // "MM-DD" format
  source: z.enum(["LIFF", "PHONE", "WALK_IN"]).optional(),
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
});

export const createServiceSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().optional(),
  duration: z.number().int().min(30).max(480),
  slotsNeeded: z.number().int().min(1).max(8),
  price: z.number().int().min(0),
  sortOrder: z.number().int().optional(),
});

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
