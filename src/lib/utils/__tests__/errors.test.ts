import { describe, it, expect } from "vitest";
import {
  AppError,
  SlotUnavailableError,
  BookingRestrictedError,
  CancellationNotAllowedError,
  errorResponse,
} from "@/lib/utils/errors";

describe("AppError", () => {
  it("creates error with default status 400", () => {
    const error = new AppError("Something went wrong");
    expect(error.message).toBe("Something went wrong");
    expect(error.statusCode).toBe(400);
    expect(error.name).toBe("AppError");
  });

  it("creates error with custom status code", () => {
    const error = new AppError("Not found", 404, "NOT_FOUND");
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe("NOT_FOUND");
  });

  it("is an instance of Error", () => {
    const error = new AppError("test");
    expect(error).toBeInstanceOf(Error);
  });
});

describe("SlotUnavailableError", () => {
  it("has correct message and status", () => {
    const error = new SlotUnavailableError();
    expect(error.message).toBe("此時段已被預約");
    expect(error.statusCode).toBe(409);
    expect(error.code).toBe("SLOT_UNAVAILABLE");
  });

  it("is an instance of AppError", () => {
    expect(new SlotUnavailableError()).toBeInstanceOf(AppError);
  });
});

describe("BookingRestrictedError", () => {
  it("has correct message and status", () => {
    const error = new BookingRestrictedError();
    expect(error.message).toContain("電話預約");
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe("BOOKING_RESTRICTED");
  });
});

describe("CancellationNotAllowedError", () => {
  it("includes phone number when provided", () => {
    const error = new CancellationNotAllowedError(
      "當天營業時間內取消，請致電店家",
      "02-2396-2306"
    );
    expect(error.phoneNumber).toBe("02-2396-2306");
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe("CANCELLATION_CALL_REQUIRED");
  });

  it("works without phone number", () => {
    const error = new CancellationNotAllowedError("當天取消將記錄為一次違規");
    expect(error.phoneNumber).toBeUndefined();
  });
});

describe("errorResponse", () => {
  async function parseResponse(response: Response) {
    return { status: response.status, body: await response.json() };
  }

  it("handles AppError with correct status and message", async () => {
    const error = new AppError("Bad request", 400, "BAD_REQUEST");
    const { status, body } = await parseResponse(errorResponse(error));
    expect(status).toBe(400);
    expect(body.error).toBe("Bad request");
    expect(body.code).toBe("BAD_REQUEST");
  });

  it("handles SlotUnavailableError as 409", async () => {
    const { status, body } = await parseResponse(
      errorResponse(new SlotUnavailableError())
    );
    expect(status).toBe(409);
    expect(body.code).toBe("SLOT_UNAVAILABLE");
  });

  it("handles CancellationNotAllowedError with phoneNumber", async () => {
    const error = new CancellationNotAllowedError(
      "請致電店家",
      "02-1234-5678"
    );
    const { status, body } = await parseResponse(errorResponse(error));
    expect(status).toBe(403);
    expect(body.phoneNumber).toBe("02-1234-5678");
    expect(body.code).toBe("CANCELLATION_CALL_REQUIRED");
  });

  it("handles unknown errors as 500 with generic message", async () => {
    const { status, body } = await parseResponse(
      errorResponse(new Error("unexpected"))
    );
    expect(status).toBe(500);
    expect(body.error).toBe("系統錯誤，請稍後再試");
    expect(body.code).toBeUndefined();
  });

  it("handles non-Error objects as 500", async () => {
    const { status, body } = await parseResponse(errorResponse("string error"));
    expect(status).toBe(500);
    expect(body.error).toBe("系統錯誤，請稍後再試");
  });
});
