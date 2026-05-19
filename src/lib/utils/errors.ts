import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public code?: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class SlotUnavailableError extends AppError {
  constructor() {
    super("此時段已被預約", 409, "SLOT_UNAVAILABLE");
  }
}

export class BookingRestrictedError extends AppError {
  constructor() {
    super("您目前僅能透過電話預約，請撥打店家電話", 403, "BOOKING_RESTRICTED");
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "請先登入") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class CancellationNotAllowedError extends AppError {
  public phoneNumber?: string;

  constructor(reason: string, phoneNumber?: string) {
    super(reason, 403, "CANCELLATION_CALL_REQUIRED");
    this.phoneNumber = phoneNumber;
  }
}

/**
 * OCC (optimistic-concurrency) guard violation.
 *
 * Thrown when an `updateMany` with `updatedAt: <prev>` returns count===0,
 * meaning the row moved underneath us between read and write. Surfaces to
 * the client as 409 with `code: "stale_write"` so the UI can prompt a refresh.
 *
 * `current` (optional) is the freshly-read row state — handy for clients
 * that want to merge instead of force-refresh.
 *
 * Audit reference: scripts/audit-booking-validation.sh — every booking-
 * mutating endpoint must use this (or inline equivalent).
 */
export class StaleWriteError extends AppError {
  public current?: unknown;

  constructor(current?: unknown, message: string = "此預約已更新，請重新整理後再試") {
    super(message, 409, "stale_write");
    this.current = current;
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof CancellationNotAllowedError) {
    return Response.json(
      { error: error.message, code: error.code, phoneNumber: error.phoneNumber },
      { status: error.statusCode }
    );
  }
  if (error instanceof StaleWriteError) {
    return Response.json(
      { error: "stale_write", code: error.code, message: error.message, current: error.current },
      { status: error.statusCode }
    );
  }
  if (error instanceof AppError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    );
  }
  if (error instanceof ZodError) {
    const firstIssue = error.issues[0];
    const fieldPath = firstIssue?.path.join(".") || "input";
    return Response.json(
      {
        error: `輸入格式錯誤：${fieldPath}`,
        code: "VALIDATION_ERROR",
        issues: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
      { status: 400 }
    );
  }
  console.error("Unexpected error:", error);
  // V3.8 incident response: 給用戶具體可行的 fallback 指示，不只是「系統錯誤」
  // FALLBACK_PHONE 從 env 讀（不寫死於 code，部署時 Vercel env 設）
  const fallbackPhone = process.env.NEXT_PUBLIC_FALLBACK_PHONE ?? "02-2396-2306";
  return Response.json(
    {
      error: "系統暫時無法處理此操作，請稍後再試",
      hint: `若情況持續，請直接打 ${fallbackPhone}`,
      code: "INTERNAL_ERROR",
    },
    { status: 500 }
  );
}
