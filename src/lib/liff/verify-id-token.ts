import { NextRequest } from "next/server";

interface LineVerifyResponse {
  sub: string;
  aud: string;
  iss: string;
  exp: number;
  name?: string;
  picture?: string;
}

/**
 * Verify a LIFF ID token via LINE's verify endpoint.
 * Returns the LINE user ID (sub) on success, null on failure.
 *
 * Docs: https://developers.line.biz/en/reference/line-login/#verify-id-token
 */
export async function verifyLineIdToken(idToken: string): Promise<string | null> {
  const clientId = process.env.LINE_CHANNEL_ID;
  if (!clientId) {
    throw new Error("LINE_CHANNEL_ID environment variable is required");
  }

  try {
    const params = new URLSearchParams();
    params.append("id_token", idToken);
    params.append("client_id", clientId);

    const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as LineVerifyResponse;
    if (!data.sub) return null;

    // Verify audience matches our channel
    if (data.aud !== clientId) return null;

    // Verify not expired
    if (data.exp * 1000 < Date.now()) return null;

    return data.sub;
  } catch {
    return null;
  }
}

/**
 * Extract and verify the LIFF ID token from a request.
 * Returns the LINE user ID (sub) on success, null on failure.
 *
 * Client sends: `Authorization: Bearer <idToken>`
 */
export async function getLineUserIdFromRequest(
  request: NextRequest
): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  if (!token) return null;
  return verifyLineIdToken(token);
}
