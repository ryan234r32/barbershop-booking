import { NextRequest } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { getAdminFromCookie } from "@/lib/auth/jwt";

/**
 * GET /api/reports — historical Excel snapshot stats (Wave 5).
 *
 * Reads pre-generated data/reports-snapshot.json (built via
 * `npm run reports:snapshot`). Live V3 system stats merged in
 * follow-up — for now serves 2025 historical data only.
 */
export async function GET(request: NextRequest) {
  const admin = await getAdminFromCookie(request);
  if (!admin) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const snapshotPath = path.join(process.cwd(), "data", "reports-snapshot.json");
  if (!fs.existsSync(snapshotPath)) {
    return Response.json(
      {
        error: "Snapshot not generated",
        message: "Run `npm run reports:snapshot` to generate from Excel",
      },
      { status: 503 },
    );
  }

  try {
    const raw = fs.readFileSync(snapshotPath, "utf-8");
    const snapshot = JSON.parse(raw);
    return Response.json(snapshot, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (err) {
    return Response.json(
      { error: "Failed to read snapshot", detail: String(err) },
      { status: 500 },
    );
  }
}
