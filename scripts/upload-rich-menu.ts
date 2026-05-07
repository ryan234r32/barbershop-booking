/**
 * Upload the 6-cell LINE Rich Menu for the customer onboarding rollout.
 *
 * Default mode is dry-run. Add --commit to create the rich menu, upload the
 * image, and set it as the tenant's default rich menu.
 *
 * Usage:
 *   npm run rich-menu:upload -- --image docs/rich-menu/rich-menu.png
 *   npm run rich-menu:upload -- --image docs/rich-menu/rich-menu.png --commit
 *
 * Env required:
 *   - DATABASE_URL
 *   - DEFAULT_TENANT_ID
 *
 * Tenant LINE token, LIFF ID, and phone number are read from DB.
 */

import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const WIDTH = 2500;
const HEIGHT = 1686;
const ROW_H = 843;
const MAX_IMAGE_BYTES = 1024 * 1024;
const COMMIT = process.argv.includes("--commit") || process.argv.includes("--confirm");
const HELP = process.argv.includes("--help") || process.argv.includes("-h");
const LAYOUT = getArg("layout") ?? "image6";
const CONTACT_ACTION = getArg("contact-action") ?? "tel";

// 2500 does not divide by 3. The middle hit area gets the extra pixel so all
// tappable bounds cover the canvas exactly: 833 + 834 + 833 = 2500.
const COLS = [
  { x: 0, width: 833 },
  { x: 833, width: 834 },
  { x: 1667, width: 833 },
];

type RichMenuAction =
  | { type: "uri"; label: string; uri: string }
  | { type: "message"; label: string; text: string };

interface RichMenuBody {
  size: { width: number; height: number };
  selected: boolean;
  name: string;
  chatBarText: string;
  areas: Array<{
    bounds: { x: number; y: number; width: number; height: number };
    action: RichMenuAction;
  }>;
}

interface LineResponse {
  ok: boolean;
  status: number;
  data: unknown;
}

function bail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function printHelp(): never {
  console.log(`
Usage:
  npm run rich-menu:upload -- --image docs/rich-menu/rich-menu.png [options]

Options:
  --image <path>            Required. PNG/JPEG, exactly 2500x1686, <= 1 MB.
  --layout <name>           image6 | handoff6 | plan6 | legacy4. Default image6.
  --contact-action <name>   tel | maps. Default tel.
  --commit                  Upload to LINE and set default. Without this, dry-run only.
  --confirm                 Alias of --commit.
  --help                    Print this help.

Layouts:
  image6:
    立即預約 / 取消／改期 / 我的預約
    服務項目 / 聯絡店家 / 匯款資訊

  handoff6:
    立即預約 / 聯絡電話 / 我的預約
    服務項目 / 取消／改期 / 匯款資訊

  plan6:
    立即預約 / 我的預約 / 取消／改期
    服務項目 / 匯款資訊 / 聯絡店家

  legacy4:
    立即預約 / 我的預約
    服務項目 / 匯款資訊
`);
  process.exit(0);
}

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  if (found) return found.slice(prefix.length);

  const idx = process.argv.indexOf(`--${name}`);
  if (idx !== -1) return process.argv[idx + 1];

  return undefined;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) bail(`${name} missing`);
  return value;
}

function normalizePhoneForTel(phone: string | null): string | null {
  if (!phone) return null;
  const normalized = phone.replace(/[^\d+]/g, "");
  return normalized.length > 0 ? normalized : null;
}

function detectImage(imagePath: string): {
  contentType: "image/png" | "image/jpeg";
  width: number;
  height: number;
  bytes: number;
} {
  const stat = fs.statSync(imagePath);
  const buffer = fs.readFileSync(imagePath);

  if (
    buffer.length >= 24 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return {
      contentType: "image/png",
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
      bytes: stat.size,
    };
  }

  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xc3) {
        return {
          contentType: "image/jpeg",
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7),
          bytes: stat.size,
        };
      }
      offset += 2 + length;
    }
  }

  bail("image must be a PNG or JPEG file");
}

function validateImage(imagePath: string) {
  if (!fs.existsSync(imagePath)) bail(`image not found: ${imagePath}`);

  const image = detectImage(imagePath);
  if (image.width !== WIDTH || image.height !== HEIGHT) {
    bail(`image must be exactly ${WIDTH}x${HEIGHT}px; got ${image.width}x${image.height}px`);
  }
  if (image.bytes > MAX_IMAGE_BYTES) {
    bail(`image must be <= 1 MB for LINE Rich Menu; got ${(image.bytes / 1024 / 1024).toFixed(2)} MB`);
  }
  return image;
}

function assertLayout(layout: string): asserts layout is "image6" | "handoff6" | "plan6" | "legacy4" {
  if (layout !== "image6" && layout !== "handoff6" && layout !== "plan6" && layout !== "legacy4") {
    bail(`unsupported --layout ${layout}; expected image6, handoff6, plan6, or legacy4`);
  }
}

function assertContactAction(action: string): asserts action is "tel" | "maps" {
  if (action !== "tel" && action !== "maps") {
    bail(`unsupported --contact-action ${action}; expected tel or maps`);
  }
}

function contactAction(params: {
  mode: "tel" | "maps";
  phone: string | null;
  address: string | null;
  businessName: string;
  label: string;
}): RichMenuAction {
  if (params.mode === "maps") {
    const query = params.address ?? params.businessName;
    return {
      type: "uri",
      label: params.label,
      uri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
    };
  }

  const tel = normalizePhoneForTel(params.phone);
  return tel
    ? { type: "uri", label: params.label, uri: `tel:${tel}` }
    : { type: "message", label: params.label, text: "電話" };
}

function buildRichMenu(params: {
  liffId: string;
  phone: string | null;
  address: string | null;
  businessName: string;
  layout: "image6" | "handoff6" | "plan6" | "legacy4";
  contactActionMode: "tel" | "maps";
}): RichMenuBody {
  const liffBase = `https://liff.line.me/${params.liffId}`;
  const common = {
    booking: { type: "uri" as const, label: "立即預約", uri: `${liffBase}/booking` },
    myBookings: { type: "uri" as const, label: "我的預約", uri: `${liffBase}/my-bookings` },
    services: { type: "message" as const, label: "服務項目", text: "服務" },
    cancelReschedule: { type: "uri" as const, label: "取消／改期", uri: `${liffBase}/my-bookings` },
    payment: { type: "message" as const, label: "匯款資訊", text: "匯款" },
  };

  const contactPhone = contactAction({
    mode: params.contactActionMode,
    phone: params.phone,
    address: params.address,
    businessName: params.businessName,
    label: "聯絡電話",
  });
  const contactStore = contactAction({
    mode: params.contactActionMode,
    phone: params.phone,
    address: params.address,
    businessName: params.businessName,
    label: "聯絡店家",
  });

  if (params.layout === "legacy4") {
    return {
      size: { width: WIDTH, height: HEIGHT },
      selected: true,
      name: "barbershop-main-menu-v4-legacy4",
      chatBarText: "選單",
      areas: [
        {
          bounds: { x: 0, y: 0, width: WIDTH / 2, height: ROW_H },
          action: common.booking,
        },
        {
          bounds: { x: WIDTH / 2, y: 0, width: WIDTH / 2, height: ROW_H },
          action: common.myBookings,
        },
        {
          bounds: { x: 0, y: ROW_H, width: WIDTH / 2, height: ROW_H },
          action: common.services,
        },
        {
          bounds: { x: WIDTH / 2, y: ROW_H, width: WIDTH / 2, height: ROW_H },
          action: common.payment,
        },
      ],
    };
  }

  const plan6Areas: RichMenuBody["areas"] = [
    {
      bounds: { x: COLS[0].x, y: 0, width: COLS[0].width, height: ROW_H },
      action: common.booking,
    },
    {
      bounds: { x: COLS[1].x, y: 0, width: COLS[1].width, height: ROW_H },
      action: common.myBookings,
    },
    {
      bounds: { x: COLS[2].x, y: 0, width: COLS[2].width, height: ROW_H },
      action: common.cancelReschedule,
    },
    {
      bounds: { x: COLS[0].x, y: ROW_H, width: COLS[0].width, height: ROW_H },
      action: common.services,
    },
    {
      bounds: { x: COLS[1].x, y: ROW_H, width: COLS[1].width, height: ROW_H },
      action: common.payment,
    },
    {
      bounds: { x: COLS[2].x, y: ROW_H, width: COLS[2].width, height: ROW_H },
      action: contactStore,
    },
  ];

  const handoff6Areas: RichMenuBody["areas"] = [
    {
      bounds: { x: COLS[0].x, y: 0, width: COLS[0].width, height: ROW_H },
      action: common.booking,
    },
    {
      bounds: { x: COLS[1].x, y: 0, width: COLS[1].width, height: ROW_H },
      action: contactPhone,
    },
    {
      bounds: { x: COLS[2].x, y: 0, width: COLS[2].width, height: ROW_H },
      action: common.myBookings,
    },
    {
      bounds: { x: COLS[0].x, y: ROW_H, width: COLS[0].width, height: ROW_H },
      action: common.services,
    },
    {
      bounds: { x: COLS[1].x, y: ROW_H, width: COLS[1].width, height: ROW_H },
      action: common.cancelReschedule,
    },
    {
      bounds: { x: COLS[2].x, y: ROW_H, width: COLS[2].width, height: ROW_H },
      action: common.payment,
    },
  ];

  const image6Areas: RichMenuBody["areas"] = [
    {
      bounds: { x: COLS[0].x, y: 0, width: COLS[0].width, height: ROW_H },
      action: common.booking,
    },
    {
      bounds: { x: COLS[1].x, y: 0, width: COLS[1].width, height: ROW_H },
      action: common.cancelReschedule,
    },
    {
      bounds: { x: COLS[2].x, y: 0, width: COLS[2].width, height: ROW_H },
      action: common.myBookings,
    },
    {
      bounds: { x: COLS[0].x, y: ROW_H, width: COLS[0].width, height: ROW_H },
      action: common.services,
    },
    {
      bounds: { x: COLS[1].x, y: ROW_H, width: COLS[1].width, height: ROW_H },
      action: contactStore,
    },
    {
      bounds: { x: COLS[2].x, y: ROW_H, width: COLS[2].width, height: ROW_H },
      action: common.payment,
    },
  ];

  return {
    size: { width: WIDTH, height: HEIGHT },
    selected: true,
    name: `barbershop-main-menu-v4-${params.layout}`,
    chatBarText: "選單",
    areas: params.layout === "image6"
      ? image6Areas
      : params.layout === "plan6"
        ? plan6Areas
        : handoff6Areas,
  };
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function lineApi(url: string, options: RequestInit, retries = 4): Promise<LineResponse> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, options);
    const contentType = res.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await res.json() : await res.text();

    if (res.ok || (res.status !== 429 && res.status < 500) || attempt === retries) {
      return { ok: res.ok, status: res.status, data };
    }

    const retryAfter = Number(res.headers.get("retry-after"));
    const waitMs = Number.isFinite(retryAfter)
      ? retryAfter * 1000
      : Math.min(8000, 500 * 2 ** attempt);
    console.warn(`  LINE API ${res.status}; retrying in ${waitMs}ms...`);
    await sleep(waitMs);
  }

  throw new Error("unreachable retry state");
}

async function validateRichMenu(token: string, body: RichMenuBody) {
  const res = await lineApi("https://api.line.me/v2/bot/richmenu/validate", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) bail(`rich menu validation failed (${res.status}): ${JSON.stringify(res.data)}`);
}

async function createRichMenu(token: string, body: RichMenuBody): Promise<string> {
  const res = await lineApi("https://api.line.me/v2/bot/richmenu", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) bail(`create rich menu failed (${res.status}): ${JSON.stringify(res.data)}`);
  return (res.data as { richMenuId: string }).richMenuId;
}

async function uploadRichMenuImage(
  token: string,
  richMenuId: string,
  imagePath: string,
  contentType: string,
) {
  const image = fs.readFileSync(imagePath);
  const res = await lineApi(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": contentType,
    },
    body: image,
  });
  if (!res.ok) bail(`upload rich menu image failed (${res.status}): ${JSON.stringify(res.data)}`);
}

async function setDefaultRichMenu(token: string, richMenuId: string) {
  const res = await lineApi(`https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) bail(`set default rich menu failed (${res.status}): ${JSON.stringify(res.data)}`);
}

async function getDefaultRichMenu(token: string): Promise<string | null> {
  const res = await lineApi("https://api.line.me/v2/bot/user/all/richmenu", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) bail(`get default rich menu failed (${res.status}): ${JSON.stringify(res.data)}`);
  return (res.data as { richMenuId: string }).richMenuId;
}

async function main() {
  if (HELP) printHelp();
  assertLayout(LAYOUT);
  assertContactAction(CONTACT_ACTION);

  const imageArg = getArg("image");
  if (!imageArg) bail("pass --image path/to/rich-menu.png");

  const imagePath = path.resolve(imageArg);
  const image = validateImage(imagePath);
  const tenantId = requireEnv("DEFAULT_TENANT_ID");
  const databaseUrl = requireEnv("DATABASE_URL");

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        businessName: true,
        phone: true,
        address: true,
        liffId: true,
        lineAccessToken: true,
      },
    });
    if (!tenant) bail(`tenant not found: ${tenantId}`);
    if (!tenant.lineAccessToken) bail("tenant.lineAccessToken missing");
    if (!tenant.liffId) bail("tenant.liffId missing");

    const body = buildRichMenu({
      liffId: tenant.liffId,
      phone: tenant.phone,
      address: tenant.address,
      businessName: tenant.businessName,
      layout: LAYOUT,
      contactActionMode: CONTACT_ACTION,
    });

    console.log("=== 6-cell LINE Rich Menu Upload ===\n");
    console.log(`Tenant: ${tenant.businessName}`);
    console.log(`Image: ${imagePath}`);
    console.log(`Layout: ${LAYOUT}`);
    console.log(`Image type: ${image.contentType}, ${(image.bytes / 1024).toFixed(1)} KB`);
    console.log(`LIFF: https://liff.line.me/${tenant.liffId}`);
    console.log(`Contact action: ${CONTACT_ACTION}`);
    console.log("\nAreas:");
    body.areas.forEach((area, i) => {
      const action =
        area.action.type === "uri"
          ? `${area.action.label} -> ${area.action.uri}`
          : `${area.action.label} -> message "${area.action.text}"`;
      console.log(`  ${i + 1}. [${area.bounds.x},${area.bounds.y},${area.bounds.width},${area.bounds.height}] ${action}`);
    });

    if (!COMMIT) {
      console.log("\n✓ DRY-RUN — re-run with --commit to validate against LINE and publish.");
      return;
    }

    const previousDefault = await getDefaultRichMenu(tenant.lineAccessToken);
    console.log(`\nPrevious Messaging API default: ${previousDefault ?? "none"}`);

    console.log("\n1. Validating rich menu body...");
    await validateRichMenu(tenant.lineAccessToken, body);

    console.log("2. Creating rich menu...");
    const richMenuId = await createRichMenu(tenant.lineAccessToken, body);
    console.log(`   Created: ${richMenuId}`);

    console.log("3. Uploading image...");
    await uploadRichMenuImage(tenant.lineAccessToken, richMenuId, imagePath, image.contentType);

    console.log("4. Setting as default...");
    await setDefaultRichMenu(tenant.lineAccessToken, richMenuId);

    console.log("\n✓ Rich Menu is live.");
    console.log(`New Rich Menu ID: ${richMenuId}`);
    if (previousDefault) {
      console.log(`Previous default kept for rollback: ${previousDefault}`);
      console.log(`Rollback command: curl -X POST https://api.line.me/v2/bot/user/all/richmenu/${previousDefault} -H "Authorization: Bearer $LINE_CHANNEL_ACCESS_TOKEN"`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
