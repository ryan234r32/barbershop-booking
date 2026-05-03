import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

type ExtendedPrismaClient = ReturnType<typeof createClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrismaClient | undefined;
  prismaAuditWriter: PrismaClient | undefined;
};

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  let baseClient: PrismaClient;
  if (!connectionString) {
    baseClient = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: "postgresql://build:build@localhost:5432/build",
      }),
    });
  } else {
    const adapter = new PrismaPg({ connectionString });
    baseClient = new PrismaClient({ adapter });
  }

  // V3.8 P0 prevention (5/1 incident): 攔截所有 destructive ops 寫 audit_log。
  // 只攔 *Many — 單筆 delete/update 不是「炸 DB」風險點。
  return baseClient.$extends({
    name: "audit-destructive-ops",
    query: {
      $allModels: {
        async deleteMany({ model, args, query }) {
          return runWithAudit(model, "deleteMany", args, () => query(args));
        },
        async updateMany({ model, args, query }) {
          return runWithAudit(model, "updateMany", args, () => query(args));
        },
      },
    },
  });
}

/**
 * Get a side prisma client for audit writes — separate from the extended
 * `prisma` to avoid recursing through the audit hook itself. Cached at module
 * level so we don't reopen connection per call.
 */
function getAuditWriter(): PrismaClient | null {
  if (globalForPrisma.prismaAuditWriter) return globalForPrisma.prismaAuditWriter;
  const conn = process.env.DATABASE_URL;
  if (!conn) return null;
  const writer = new PrismaClient({ adapter: new PrismaPg({ connectionString: conn }) });
  globalForPrisma.prismaAuditWriter = writer;
  return writer;
}

/**
 * Wrap a destructive op: time it, run it, write audit_log row whether op
 * succeeded or threw. Failures re-thrown. Audit write is best-effort and
 * fire-and-forget — never blocks or propagates errors.
 */
async function runWithAudit<T extends { count: number }>(
  model: string,
  action: "deleteMany" | "updateMany",
  args: unknown,
  exec: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  try {
    const result = await exec();
    void writeAuditAsync(model, action, args, result.count, null, Date.now() - start);
    return result;
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    void writeAuditAsync(model, action, args, 0, err, Date.now() - start);
    throw err;
  }
}

async function writeAuditAsync(
  model: string,
  action: "deleteMany" | "updateMany",
  args: unknown,
  count: number,
  error: Error | null,
  durationMs: number,
): Promise<void> {
  try {
    const writer = getAuditWriter();
    if (!writer) return;
    const argsRaw = safeStringify(args).slice(0, 4096);
    await writer.auditLog.create({
      data: {
        model,
        action,
        count,
        executor: process.env.EXECUTED_BY ?? "unknown",
        args: argsRaw ? { raw: argsRaw } : undefined,
        durationMs,
        status: error ? `error: ${error.message.slice(0, 200)}` : "success",
      },
    });
  } catch (auditErr) {
    // Audit DB write failure must never break business logic.
    // Most likely cause: audit_logs table not yet migrated → see prisma db push.
    console.warn(
      "[audit-log] write failed (non-fatal):",
      auditErr instanceof Error ? auditErr.message : String(auditErr),
    );
  }
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v, (_k, val) =>
      typeof val === "bigint" ? val.toString() : val,
    );
  } catch {
    return "<unserializable>";
  }
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
