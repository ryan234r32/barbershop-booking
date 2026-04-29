/**
 * Broadcast the launch announcement Flex message to every real LINE user
 * (skips legacy stub records which have no real LINE userId).
 *
 * Usage:
 *   # dry-run — show counts and first few recipients, don't send
 *   npx tsx scripts/broadcast-launch.ts
 *
 *   # actually send
 *   npx tsx scripts/broadcast-launch.ts --commit
 *
 *   # custom deadline / prize text via env (or edit constants below)
 *   LOTTERY_DEADLINE_LABEL="5/10 (週六)" \
 *   LOTTERY_PRIZE_LABEL="5 名免費剪髮" \
 *   npx tsx scripts/broadcast-launch.ts --commit
 *
 * Env required:
 *   - DATABASE_URL, DEFAULT_TENANT_ID
 *   - NEXT_PUBLIC_LIFF_ID (for the form deeplink)
 *
 * Tenant LINE access token is read from DB (per-tenant).
 *
 * Respects User.marketingOptOut — opted-out customers are skipped.
 *
 * Sends sequentially with a small delay (200ms) to stay under LINE push rate
 * limits. For 1169 users, total time ~4 min.
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { Client } from "@line/bot-sdk";
import { launchAnnouncementMessage } from "../src/lib/line/messages";

const COMMIT = process.argv.includes("--commit");

const PRIZE_LABEL = process.env.LOTTERY_PRIZE_LABEL || "5 名免費剪髮一次";
const DEADLINE_LABEL = process.env.LOTTERY_DEADLINE_LABEL || "活動截止日請見訊息";

function bail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

const tenantId = process.env.DEFAULT_TENANT_ID;
const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
if (!tenantId) bail("DEFAULT_TENANT_ID missing");
if (!liffId) bail("NEXT_PUBLIC_LIFF_ID missing");

const profileUrl = `https://liff.line.me/${liffId}/profile`;

const prisma = new PrismaClient();

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId! },
    select: {
      lineAccessToken: true,
      lineChannelSecret: true,
      businessName: true,
    },
  });
  if (!tenant) bail("tenant not found");

  // Real LINE users only — legacy stubs have synthetic lineUserId starting
  // with "legacy-" and no real LINE recipient to push to.
  const recipients = await prisma.user.findMany({
    where: {
      tenantId: tenantId!,
      NOT: { lineUserId: { startsWith: "legacy-" } },
      marketingOptOut: false,
    },
    select: { id: true, lineUserId: true, displayName: true },
  });

  console.log(`Tenant: ${tenant!.businessName}`);
  console.log(`Profile URL: ${profileUrl}`);
  console.log(`Prize: ${PRIZE_LABEL}`);
  console.log(`Deadline: ${DEADLINE_LABEL}`);
  console.log(`Recipients: ${recipients.length} real LINE users\n`);

  if (recipients.length > 0) {
    console.log("Sample (first 3):");
    recipients.slice(0, 3).forEach((u) => {
      console.log(`  - ${u.displayName ?? "—"} (${u.lineUserId.slice(0, 12)}…)`);
    });
    console.log();
  }

  if (!COMMIT) {
    console.log("✓ DRY-RUN — re-run with --commit to actually send.");
    return;
  }

  const client = new Client({
    channelAccessToken: tenant!.lineAccessToken,
    channelSecret: tenant!.lineChannelSecret,
  });
  const message = launchAnnouncementMessage({
    shopName: tenant!.businessName,
    profileUrl,
    deadlineLabel: DEADLINE_LABEL,
    prizeLabel: PRIZE_LABEL,
  });

  let sent = 0;
  let failed = 0;
  for (let i = 0; i < recipients.length; i++) {
    const u = recipients[i];
    try {
      await client.pushMessage(u.lineUserId, message);
      sent++;
    } catch (err) {
      failed++;
      console.error(
        `  ✗ ${u.displayName ?? u.lineUserId}: ${err instanceof Error ? err.message : err}`,
      );
    }
    if (i % 50 === 49) {
      console.log(`  progress: ${i + 1}/${recipients.length} (sent=${sent}, failed=${failed})`);
    }
    await sleep(200);
  }

  console.log(`\n✓ done — sent=${sent}, failed=${failed}`);
}

main()
  .then(() => prisma.$disconnect().then(() => process.exit(0)))
  .catch(async (err) => {
    console.error("✗", err);
    await prisma.$disconnect();
    process.exit(1);
  });
