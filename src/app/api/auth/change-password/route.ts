import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminFromCookie } from "@/lib/auth/jwt";
import { errorResponse } from "@/lib/utils/errors";
import bcrypt from "bcryptjs";

/** POST /api/auth/change-password — change admin password */
export async function POST(request: NextRequest) {
  try {
    const session = await getAdminFromCookie(request);
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { currentPassword, newPassword } = (await request.json()) as {
      currentPassword: string;
      newPassword: string;
    };

    if (!currentPassword || !newPassword) {
      return Response.json({ error: "請輸入目前密碼和新密碼" }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return Response.json({ error: "新密碼至少 6 個字元" }, { status: 400 });
    }

    const admin = await prisma.adminUser.findUnique({ where: { id: session.adminId } });
    if (!admin) {
      return Response.json({ error: "帳號不存在" }, { status: 404 });
    }

    const valid = await bcrypt.compare(currentPassword, admin.password);
    if (!valid) {
      return Response.json({ error: "目前密碼不正確" }, { status: 400 });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { password: hashed },
    });

    return Response.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
