import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/utils/errors";
import { getAdminFromCookie } from "@/lib/auth/jwt";

const STATUS_LABELS: Record<string, string> = {
  CONFIRMED: "已確認",
  COMPLETED: "已完成",
  CANCELLED: "已取消",
  NO_SHOW: "未到店",
  CANCELLED_BY_ADMIN: "管理員取消",
};

const PAYMENT_LABELS: Record<string, string> = {
  PENDING: "待付款",
  RECEIVED: "已收款",
  WAIVED: "免收",
};

/** GET /api/admin/export — export bookings as CSV */
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const tenantId = admin.tenantId;

    // Default: last 30 days
    const now = new Date();
    const startDate = from ? new Date(from) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const endDate = to ? new Date(to) : now;

    const bookings = await prisma.booking.findMany({
      where: {
        tenantId,
        date: { gte: startDate, lte: endDate },
      },
      include: {
        user: { select: { displayName: true, realName: true, phone: true } },
        service: { select: { name: true, price: true } },
        payment: { select: { status: true } },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    // BOM for Excel UTF-8 compatibility
    const BOM = "\uFEFF";
    const header = "預約編號,日期,時間,顧客,服務,價格,狀態,付款狀態";
    const rows = bookings.map((b) => {
      const dateStr = new Date(b.date).toISOString().split("T")[0];
      const customerName = b.user.realName || b.user.displayName || "未知";
      const escapedName = customerName.includes(",") ? `"${customerName}"` : customerName;
      const serviceName = b.service.name.includes(",") ? `"${b.service.name}"` : b.service.name;
      return [
        b.id.slice(0, 8),
        dateStr,
        `${b.startTime}-${b.endTime}`,
        escapedName,
        serviceName,
        b.service.price,
        STATUS_LABELS[b.status] || b.status,
        b.payment ? (PAYMENT_LABELS[b.payment.status] || b.payment.status) : "無",
      ].join(",");
    });

    const csv = BOM + [header, ...rows].join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="bookings_${startDate.toISOString().split("T")[0]}_${endDate.toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
