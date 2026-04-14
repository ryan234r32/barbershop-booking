import { prisma } from "@/lib/prisma";
import { adminLoginSchema } from "@/lib/utils/validation";
import { errorResponse } from "@/lib/utils/errors";
import { signAdminToken, setAdminCookie } from "@/lib/auth/jwt";
import { checkLoginRateLimit, clearLoginAttempts } from "@/lib/auth/login-rate-limit";
import bcrypt from "bcryptjs";

function clientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for") || "";
  return xff.split(",")[0].trim() || "unknown";
}

/** POST /api/auth/login — admin login */
export async function POST(request: Request) {
  try {
    const ip = clientIp(request);

    const rate = await checkLoginRateLimit(ip);
    if (!rate.allowed) {
      return Response.json(
        { error: "登入嘗試次數過多，請稍後再試", code: "RATE_LIMITED" },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
      );
    }

    const body = await request.json();
    const { email, password } = adminLoginSchema.parse(body);

    const admin = await prisma.adminUser.findFirst({
      where: { email, isActive: true },
      include: { tenant: { select: { businessName: true } } },
    });

    if (!admin) {
      return Response.json({ error: "帳號或密碼錯誤" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) {
      return Response.json({ error: "帳號或密碼錯誤" }, { status: 401 });
    }

    await clearLoginAttempts(ip);

    const token = signAdminToken({
      adminId: admin.id,
      tenantId: admin.tenantId,
      role: admin.role,
    });

    const response = Response.json({
      token, // for localStorage storage (iOS PWA survives cookie purge)
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        tenantId: admin.tenantId,
        businessName: admin.tenant.businessName,
      },
    });

    return setAdminCookie(response, token);
  } catch (error) {
    return errorResponse(error);
  }
}
