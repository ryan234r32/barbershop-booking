import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";

const COOKIE_NAME = "admin_token";

// Lazy getter — resolves JWT_SECRET on first call site, not at module load.
// Why: Vercel runs `next build` page-data-collection that imports every route
// module. Top-level `throw new Error("JWT_SECRET required")` made preview
// builds fail across PRs #91-98 because preview env wasn't fully provisioned.
// Lazy resolution moves the throw from build-time module-load to first actual
// sign/verify call — fail-fast still works at request boundary, build passes
// without env vars set.
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  return secret;
}

export interface AdminJwtPayload {
  adminId: string;
  tenantId: string;
  role: string;
}

export function signAdminToken(payload: AdminJwtPayload): string {
  return jwt.sign(payload, getJwtSecret(), { algorithm: "HS256", expiresIn: "30d" });
}

export function verifyAdminToken(token: string): AdminJwtPayload | null {
  try {
    // Pin algorithms to block algorithm-confusion attacks. jsonwebtoken v9+
    // mitigates the classic RS256→HS256 pivot, but explicit allowlisting is
    // defense-in-depth and costs nothing.
    return jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] }) as AdminJwtPayload;
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
