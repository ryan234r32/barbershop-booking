import { getLineClient } from "@/lib/line/client";
import { adminNewBookingMessage, adminCancellationMessage } from "@/lib/line/messages";

/**
 * Send LINE push notification to admin when a new booking is created.
 * Fire-and-forget — should never block booking creation.
 */
export async function notifyAdminNewBooking(params: {
  tenantId?: string;
  displayName: string;
  serviceName: string;
  date: string;
  startTime: string;
  endTime: string;
  price: number;
}): Promise<void> {
  const adminLineUserId = process.env.ADMIN_LINE_USER_ID;
  if (!adminLineUserId) return;

  const lineClient = getLineClient();
  const message = adminNewBookingMessage(params);
  await lineClient.pushMessage(adminLineUserId, message);
}

/**
 * Send LINE push notification to admin when a booking is cancelled.
 * Fire-and-forget — should never block cancellation flow.
 */
export async function notifyAdminCancellation(params: {
  tenantId?: string;
  displayName: string;
  serviceName: string;
  date: string;
  startTime: string;
  isViolation: boolean;
  cancelledBy: "customer" | "admin";
}): Promise<void> {
  const adminLineUserId = process.env.ADMIN_LINE_USER_ID;
  if (!adminLineUserId) return;

  const lineClient = getLineClient();
  const message = adminCancellationMessage(params);
  await lineClient.pushMessage(adminLineUserId, message);
}
