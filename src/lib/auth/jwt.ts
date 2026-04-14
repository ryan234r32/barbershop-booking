import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const COOKIE_NAME = "admin_token";

export interface AdminJwtPayload {
  adminId: string;
  tenantId: string;
  role: string;
}

export function signAdminToken(payload: AdminJwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyAdminToken(token: string): AdminJwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AdminJwtPayload;
  } catch {
    return null;
  }
}

export async function getAdminFromCookie(
  request: NextRequest
): Promise<AdminJwtPayload | null> {
  // 1. Prefer Authorization: Bearer <token> (works in iOS PWA where cookies may be purged)
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) {
      const payload = verifyAdminToken(token);
      if (payload) return payload;
    }
  }

  // 2. Fallback to cookie (regular browser usage)
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

export function setAdminCookie(response: Response, token: string): Response {
  response.headers.append(
    "Set-Cookie",
    `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}${
      process.env.NODE_ENV === "production" ? "; Secure" : ""
    }`
  );
  return response;
}
