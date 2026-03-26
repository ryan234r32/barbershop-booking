import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { logger } from "@/lib/utils/logger";

describe("logger", () => {
  const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  beforeEach(() => {
    logSpy.mockClear();
    warnSpy.mockClear();
    errorSpy.mockClear();
  });

  afterAll(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  describe("info", () => {
    it("calls console.log without throwing", () => {
      expect(() => logger.info("test message")).not.toThrow();
      expect(logSpy).toHaveBeenCalledOnce();
    });

    it("includes message in output", () => {
      logger.info("server started");
      const output = logSpy.mock.calls[0][0] as string;
      expect(output).toContain("server started");
    });

    it("includes context when provided", () => {
      logger.info("processing", "BookingController");
      const output = logSpy.mock.calls[0][0] as string;
      expect(output).toContain("BookingController");
    });

    it("includes data when provided", () => {
      logger.info("created booking", { bookingId: "abc-123" });
      const output = logSpy.mock.calls[0][0] as string;
      expect(output).toContain("abc-123");
    });
  });

  describe("warn", () => {
    it("calls console.warn without throwing", () => {
      expect(() => logger.warn("low disk space")).not.toThrow();
      expect(warnSpy).toHaveBeenCalledOnce();
    });

    it("includes message in output", () => {
      logger.warn("rate limit approaching");
      const output = warnSpy.mock.calls[0][0] as string;
      expect(output).toContain("rate limit approaching");
    });
  });

  describe("error", () => {
    it("calls console.error without throwing", () => {
      expect(() => logger.error("db connection failed")).not.toThrow();
      expect(errorSpy).toHaveBeenCalledOnce();
    });

    it("includes stack trace when Error is provided", () => {
      const err = new Error("connection timeout");
      logger.error("database error", err);
      const output = errorSpy.mock.calls[0][0] as string;
      expect(output).toContain("connection timeout");
      expect(output).toContain("Error");
    });

    it("includes error name and message in output", () => {
      const err = new TypeError("invalid argument");
      logger.error("validation failed", err);
      const output = errorSpy.mock.calls[0][0] as string;
      expect(output).toContain("TypeError");
      expect(output).toContain("invalid argument");
    });

    it("handles non-Error objects gracefully", () => {
      expect(() => logger.error("unexpected", "string error")).not.toThrow();
      const output = errorSpy.mock.calls[0][0] as string;
      expect(output).toContain("string error");
    });

    it("handles null/undefined error gracefully", () => {
      expect(() => logger.error("something broke", null)).not.toThrow();
      expect(() => logger.error("something broke", undefined)).not.toThrow();
    });
  });
});
