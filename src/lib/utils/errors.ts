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

export class CancellationNotAllowedError extends AppError {
  public phoneNumber?: string;

  constructor(reason: string, phoneNumber?: string) {
    super(reason, 403, "CANCELLATION_CALL_REQUIRED");
    this.phoneNumber = phoneNumber;
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof CancellationNotAllowedError) {
    return Response.json(
      { error: error.message, code: error.code, phoneNumber: error.phoneNumber },
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
  return Response.json(
    { error: "系統錯誤，請稍後再試" },
    { status: 500 }
  );
}
