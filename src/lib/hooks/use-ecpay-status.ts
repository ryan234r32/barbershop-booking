"use client";

import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Shape returned by `GET /api/payments/[bookingId]/ecpay/status`.
 * Server route whitelists exactly these fields (see
 * src/app/api/payments/[bookingId]/ecpay/status/route.ts).
 */
export interface EcpayOrderStatus {
  status: "PENDING" | "PAID" | "EXPIRED" | "FAILED" | "REFUNDED";
  vAccount: string | null;
  bankCode: string | null;
  expireDate: string | null;
  amount: number;
}

export interface UseEcpayStatusOptions {
  /** Turn polling on/off. When false, the hook sits idle. */
  enabled: boolean;
  /** Milliseconds between polls. Defaults to 2000 per the spec. */
  intervalMs?: number;
  /** Max consecutive fetch errors before giving up and surfacing `error`. */
  maxConsecutiveErrors?: number;
  /** Cap total polling time (ms). After this we stop and set `timedOut=true`. */
  maxDurationMs?: number;
  /** LIFF ID token header value. If null/undefined, no header sent. */
  idToken?: string | null;
}

export interface UseEcpayStatusResult {
  data: EcpayOrderStatus | null;
  /** Null until we've seen our first error, or when the last poll succeeded. */
  error: string | null;
  /** True once polling has been auto-stopped (PAID/EXPIRED/error cap/timeout). */
  stopped: boolean;
  /** True when we stopped because `maxDurationMs` elapsed without vAccount. */
  timedOut: boolean;
  /** Manual one-shot refetch (used by the "我已匯款" button). Ignores polling state. */
  refetch: () => Promise<EcpayOrderStatus | null>;
}

/**
 * Polls the ECPay order status endpoint for a booking.
 *
 * Auto-stop conditions:
 *   - status ∈ {PAID, EXPIRED, FAILED, REFUNDED}
 *   - consecutive errors ≥ maxConsecutiveErrors (default 5)
 *   - total elapsed ≥ maxDurationMs (default 30_000)
 *
 * We keep polling after vAccount first appears iff status is still PENDING —
 * that way the display stays in sync if the customer pays and the webhook
 * fires while they're still on the page.
 */
export function useEcpayStatus(
  bookingId: string,
  opts: UseEcpayStatusOptions,
): UseEcpayStatusResult {
  const {
    enabled,
    intervalMs = 2000,
    maxConsecutiveErrors = 5,
    maxDurationMs = 30_000,
    idToken,
  } = opts;

  const [data, setData] = useState<EcpayOrderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stopped, setStopped] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  const errorCountRef = useRef(0);
  const startedAtRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  const fetchOnce = useCallback(async (): Promise<EcpayOrderStatus | null> => {
    const res = await fetch(`/api/payments/${bookingId}/ecpay/status`, {
      headers: idToken
        ? { "X-LIFF-ID-Token": idToken, Authorization: `Bearer ${idToken}` }
        : {},
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`status ${res.status}`);
    }
    return (await res.json()) as EcpayOrderStatus;
  }, [bookingId, idToken]);

  useEffect(() => {
    if (!enabled) return;

    cancelledRef.current = false;
    startedAtRef.current = Date.now();
    errorCountRef.current = 0;

    const tick = async () => {
      if (cancelledRef.current) return;
      try {
        const next = await fetchOnce();
        if (cancelledRef.current) return;
        errorCountRef.current = 0;
        setError(null);
        setData(next);

        // Terminal states — stop polling.
        if (next && next.status !== "PENDING") {
          setStopped(true);
          return;
        }
        // Duration cap: if still no vAccount after maxDurationMs, time out.
        const elapsed = Date.now() - (startedAtRef.current ?? Date.now());
        if (elapsed >= maxDurationMs && !next?.vAccount) {
          setTimedOut(true);
          setStopped(true);
          return;
        }
      } catch (err) {
        if (cancelledRef.current) return;
        errorCountRef.current += 1;
        const msg = err instanceof Error ? err.message : "fetch failed";
        setError(msg);
        if (errorCountRef.current >= maxConsecutiveErrors) {
          setStopped(true);
          return;
        }
      }
      timerRef.current = setTimeout(tick, intervalMs);
    };

    // Kick off immediately so the user doesn't wait `intervalMs` for the first poll.
    tick();

    return () => {
      cancelledRef.current = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled, fetchOnce, intervalMs, maxConsecutiveErrors, maxDurationMs]);

  const refetch = useCallback(async () => {
    try {
      const next = await fetchOnce();
      setData(next);
      setError(null);
      return next;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "fetch failed";
      setError(msg);
      return null;
    }
  }, [fetchOnce]);

  return { data, error, stopped, timedOut, refetch };
}
