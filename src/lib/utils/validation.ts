import { z } from "zod";

export const createBookingSchema = z.object({
  tenantId: z.string().uuid().optional(),
  serviceId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:00$/),
  lineUserId: z.string().min(1),
  notes: z.string().optional(),
});

export const cancelBookingSchema = z.object({
  reason: z.string().optional(),
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

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;
export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
