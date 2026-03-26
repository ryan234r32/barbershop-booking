type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: string;
  timestamp: string;
  data?: Record<string, unknown>;
  stack?: string;
}

function formatEntry(entry: LogEntry): string {
  if (process.env.NODE_ENV === "production") {
    // JSON format for Vercel log parsing
    return JSON.stringify(entry);
  }

  // Human-readable format for development
  const prefix = `[${entry.timestamp}] ${entry.level.toUpperCase()}`;
  const ctx = entry.context ? ` [${entry.context}]` : "";
  const data = entry.data ? `\n  data: ${JSON.stringify(entry.data, null, 2)}` : "";
  const stack = entry.stack ? `\n  ${entry.stack}` : "";
  return `${prefix}${ctx} ${entry.message}${data}${stack}`;
}

function createEntry(
  level: LogLevel,
  message: string,
  contextOrData?: string | Record<string, unknown>,
  maybeData?: Record<string, unknown>
): LogEntry {
  const context = typeof contextOrData === "string" ? contextOrData : undefined;
  const data = typeof contextOrData === "object" ? contextOrData : maybeData;

  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(context && { context }),
    ...(data && { data }),
  };
}

export const logger = {
  info(message: string, contextOrData?: string | Record<string, unknown>, data?: Record<string, unknown>) {
    const entry = createEntry("info", message, contextOrData, data);
    console.log(formatEntry(entry));
  },

  warn(message: string, contextOrData?: string | Record<string, unknown>, data?: Record<string, unknown>) {
    const entry = createEntry("warn", message, contextOrData, data);
    console.warn(formatEntry(entry));
  },

  error(
    message: string,
    error?: unknown,
    contextOrData?: string | Record<string, unknown>,
    data?: Record<string, unknown>
  ) {
    const entry = createEntry("error", message, contextOrData, data);

    if (error instanceof Error) {
      entry.stack = error.stack;
      entry.data = {
        ...entry.data,
        errorName: error.name,
        errorMessage: error.message,
      };
    } else if (error !== undefined && error !== null) {
      entry.data = { ...entry.data, errorDetail: String(error) };
    }

    console.error(formatEntry(entry));
  },
};
