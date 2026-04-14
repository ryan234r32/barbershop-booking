/**
 * LINE LIFF ID token verification.
 *
 * LIFF v2 clients call liff.getIDToken() to get a JWT signed by LINE.
 * We send that token to LINE's verify endpoint, which returns the verified
 * payload (sub = LINE user ID, aud = our channel ID, etc).
 *
 * Docs: https://developers.line.biz/en/reference/liff/#verify-id-token
 */

const LINE_VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify";

export interface LiffIdTokenPayload {
  /** LINE user ID (e.g. "U1234...") */
  sub: string;
  /** Channel ID this token was issued for — must match our LINE_CHANNEL_ID */
  aud: string;
  /** Issuer — always "https://access.line.me" */
  iss: string;
  /** Expiration (Unix seconds) */
  exp: number;
  /** Issued-at (Unix seconds) */
  iat: number;
  /** Display name, if profile scope granted */
  name?: string;
  picture?: string;
  email?: string;
}

export class LiffTokenVerificationError extends Error {
  constructor(
    message: string,
    public readonly reason: "invalid" | "expired" | "wrong_audience" | "network"
  ) {
    super(message);
    this.name = "LiffTokenVerificationError";
  }
}

/**
 * Verify a LIFF ID token with LINE's verify endpoint.
 * Throws LiffTokenVerificationError on any failure.
 */
export async function verifyLiffIdToken(
  idToken: string,
  channelId: string
): Promise<LiffIdTokenPayload> {
  if (!idToken || !channelId) {
    throw new LiffTokenVerificationError("Missing token or channelId", "invalid");
  }

  const body = new URLSearchParams({ id_token: idToken, client_id: channelId });

  let res: Response;
  try {
    res = await fetch(LINE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  } catch (e) {
    throw new LiffTokenVerificationError(
      `LINE verify API unreachable: ${(e as Error).message}`,
      "network"
    );
  }

  if (!res.ok) {
    // LINE returns 400 with { error, error_description } for invalid tokens
    const detail = await res.text().catch(() => "");
    throw new LiffTokenVerificationError(
      `LINE rejected token (${res.status}): ${detail.slice(0, 200)}`,
      res.status >= 500 ? "network" : "invalid"
    );
  }

  const payload = (await res.json()) as Partial<LiffIdTokenPayload>;

  if (!payload.sub || typeof payload.sub !== "string") {
    throw new LiffTokenVerificationError("Verify response missing sub", "invalid");
  }
  if (payload.aud !== channelId) {
    throw new LiffTokenVerificationError(
      `Token audience ${payload.aud} does not match channel ${channelId}`,
      "wrong_audience"
    );
  }
  if (payload.iss !== "https://access.line.me") {
    throw new LiffTokenVerificationError(
      `Token issuer ${payload.iss} is not LINE`,
      "invalid"
    );
  }
  if (!payload.exp || payload.exp * 1000 < Date.now()) {
    throw new LiffTokenVerificationError("Token expired", "expired");
  }

  return payload as LiffIdTokenPayload;
}
