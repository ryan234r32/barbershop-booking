import { prisma } from "@/lib/prisma";
import { getLineClient } from "@/lib/line/client";
import {
  reminderMessage,
  thankYouMessage,
  followUpMessage,
  birthdayMessage,
} from "@/lib/line/messages";

/**
 * Process and send all pending notifications that are due.
 * Called by the /api/cron/reminders endpoint hourly.
 */
export async function processPendingNotifications() {
  const now = new Date();

  const pendingNotifications = await prisma.notification.findMany({
    where: {
      status: "PENDING",
      scheduledAt: { lte: now },
    },
    include: {
      booking: {
        include: {
          service: true,
          tenant: true,
        },
      },
    },
    take: 50, // Process in batches
  });

  const lineClient = getLineClient();
  const results = { sent: 0, failed: 0 };

  for (const notification of pendingNotifications) {
    try {
      const { booking } = notification;

      // --- THANK_YOU ---
      if (notification.type === "THANK_YOU" && booking) {
        const liffUrl = `https://liff.line.me/${booking.tenant.liffId || process.env.NEXT_PUBLIC_LIFF_ID}`;
        const message = thankYouMessage({
          shopName: booking.tenant.businessName,
          serviceName: booking.service.name,
          liffUrl,
        });

        await lineClient.pushMessage(notification.lineUserId, message);
        await prisma.notification.update({
          where: { id: notification.id },
          data: { status: "SENT", sentAt: now },
        });
        results.sent++;

      // --- FOLLOW_UP_7D ---
      } else if (notification.type === "FOLLOW_UP_7D" && booking) {
        const liffUrl = `https://liff.line.me/${booking.tenant.liffId || process.env.NEXT_PUBLIC_LIFF_ID}`;
        const payload = notification.messagePayload as {
          serviceType: "perm" | "color";
        } | null;
        const serviceType = payload?.serviceType || "perm";

        const message = followUpMessage({
          serviceType,
          serviceName: booking.service.name,
          shopName: booking.tenant.businessName,
          liffUrl,
        });

        await lineClient.pushMessage(notification.lineUserId, message);
        await prisma.notification.update({
          where: { id: notification.id },
          data: { status: "SENT", sentAt: now },
        });
        results.sent++;

      // --- BIRTHDAY_GREETING ---
      } else if (notification.type === "BIRTHDAY_GREETING") {
        // Birthday notifications have no booking — use messagePayload for displayName
        const payload = notification.messagePayload as {
          displayName?: string | null;
        } | null;

        // Get tenant info for shop name and LIFF URL
        const tenant = await prisma.tenant.findUnique({
          where: { id: notification.tenantId },
        });
        if (!tenant) {
          await prisma.notification.update({
            where: { id: notification.id },
            data: { status: "FAILED", errorMessage: "Tenant not found" },
          });
          results.failed++;
          continue;
        }

        const liffUrl = `https://liff.line.me/${tenant.liffId || process.env.NEXT_PUBLIC_LIFF_ID}`;
        const message = birthdayMessage({
          displayName: payload?.displayName || "",
          shopName: tenant.businessName,
          liffUrl,
        });

        await lineClient.pushMessage(notification.lineUserId, message);
        await prisma.notification.update({
          where: { id: notification.id },
          data: { status: "SENT", sentAt: now },
        });
        results.sent++;

      // --- REMINDER (24H or 2H) ---
      } else if (booking && booking.status === "CONFIRMED") {
        const reminderLiffUrl = booking.tenant.liffId
          ? `https://liff.line.me/${booking.tenant.liffId}`
          : undefined;
        const hoursUntil = notification.type === "REMINDER_2H" ? 2 : 24;
        const message = reminderMessage({
          serviceName: booking.service.name,
          date: booking.date.toISOString().split("T")[0],
          startTime: booking.startTime,
          shopName: booking.tenant.businessName,
          hoursUntil,
          bookingId: booking.id,
          liffBaseUrl: reminderLiffUrl,
          shopAddress: booking.tenant.address || undefined,
        });

        await lineClient.pushMessage(notification.lineUserId, message);
        await prisma.notification.update({
          where: { id: notification.id },
          data: { status: "SENT", sentAt: now },
        });
        results.sent++;

      // --- CUSTOM (ECPay Tier S: received / admin_notify / amount_mismatch) ---
      } else if (notification.type === "CUSTOM") {
        const payload = (notification.messagePayload ?? {}) as {
          kind?: string;
          amount?: number;
          bookingId?: string;
          customerName?: string;
          merchantTradeNo?: string;
          expected?: number;
          actual?: number;
        };

        let text: string | null = null;
        if (payload.kind === "ecpay_received") {
          const amt = payload.amount != null ? `NT$${payload.amount.toLocaleString()}` : "";
          text = `✅ 已收到您的付款 ${amt}，感謝您！我們已確認入帳。`;
        } else if (payload.kind === "ecpay_admin_notify") {
          const name = payload.customerName || "客戶";
          const amt = payload.amount != null ? `NT$${payload.amount.toLocaleString()}` : "";
          text = `💰 綠界入帳\n${name} · ${amt}`;
        } else if (payload.kind === "ecpay_amount_mismatch") {
          text = `⚠️ 綠界金額對不上\n訂單：${payload.merchantTradeNo ?? "?"}\n應收：NT$${payload.expected ?? "?"}\n實收：NT$${payload.actual ?? "?"}\n請手動處理。`;
        }

        if (text) {
          await lineClient.pushMessage(notification.lineUserId, { type: "text", text });
          await prisma.notification.update({
            where: { id: notification.id },
            data: { status: "SENT", sentAt: now },
          });
          results.sent++;
        } else {
          await prisma.notification.update({
            where: { id: notification.id },
            data: { status: "CANCELLED" },
          });
        }

      } else {
        // Booking was cancelled or missing — skip notification
        await prisma.notification.update({
          where: { id: notification.id },
          data: { status: "CANCELLED" },
        });
      }
    } catch (error) {
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: "FAILED",
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        },
      });
      results.failed++;
    }
  }

  return results;
}
