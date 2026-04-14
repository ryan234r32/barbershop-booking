import { prisma } from "@/lib/prisma";
import { adminLoginSchema } from "@/lib/utils/validation";
import { errorResponse } from "@/lib/utils/errors";
import { signAdminToken, setAdminCookie } from "@/lib/auth/jwt";
import bcrypt from "bcryptjs";

/** POST /api/auth/login — admin login */
export async function POST(request: Request) {
  try {
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
