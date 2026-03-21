import crypto from "crypto";

/**
 * Verify LINE webhook signature.
 * @see https://developers.line.biz/en/docs/messaging-api/receiving-messages/#verifying-signatures
 */
export function verifyLineSignature(
  body: string,
  signature: string,
  channelSecret: string
): boolean {
  const hash = crypto
    .createHmac("sha256", channelSecret)
    .update(body)
    .digest("base64");
  return hash === signature;
}
