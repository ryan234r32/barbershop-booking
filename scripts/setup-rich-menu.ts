/**
 * Rich Menu Setup Script for LINE Barbershop Booking Bot
 *
 * Creates a 3×2 Rich Menu with 6 buttons (PRD-v3 §11 #1, 碩展訪談 1.2):
 *   Top-Left     — "立即預約"   → opens LIFF booking page
 *   Top-Mid      — "我的預約"   → sends "我的預約" (dynamic Flex via webhook)
 *   Top-Right    — "服務項目"   → sends "服務價目" → pricing carousel
 *   Bottom-Left  — "💰 匯款"    → sends "匯款" → payment guide Flex
 *   Bottom-Mid   — "↻ 改/取消"  → sends "改時間" → my-bookings Flex with reschedule/cancel buttons
 *   Bottom-Right — "門市資訊"   → opens Google Maps to store location
 *
 * Usage:
 *   npx tsx scripts/setup-rich-menu.ts
 *   npx tsx scripts/setup-rich-menu.ts --image path/to/rich-menu.png
 *
 * Prerequisites:
 *   - .env with LINE_CHANNEL_ACCESS_TOKEN and NEXT_PUBLIC_LIFF_ID
 *   - A 2500x1686 PNG image saved at scripts/rich-menu.png (or pass --image)
 *
 * Layout: 2500x1686, 3 cols × 2 rows, ~833 wide × 843 high per cell
 */

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const LINE_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID;

if (!LINE_ACCESS_TOKEN) {
  console.error("ERROR: LINE_CHANNEL_ACCESS_TOKEN is not set in .env");
  process.exit(1);
}
if (!LIFF_ID) {
  console.error("ERROR: NEXT_PUBLIC_LIFF_ID is not set in .env");
  process.exit(1);
}

const LIFF_BASE = `https://liff.line.me/${LIFF_ID}`;

// Google Maps link for 門市資訊. Replace with your actual shop's share link
// (open Google Maps → search your shop → Share → Copy Link).
const STORE_MAP_URL = "https://maps.google.com/?q=1008+Hair+Studio";

// ---------------------------------------------------------------------------
// Rich Menu Definition (3×2 grid: 2500x1686, 3 cols × 2 rows)
// PRD-v3 §11 #1: 4→6 格重構，加 💰 匯款 + ↻ 改/取消
// ---------------------------------------------------------------------------

// Cell width: 2500 / 3 = 833.33 — split as 833 / 834 / 833 to absorb the rounding
const C1_W = 833;
const C2_W = 834;
const C3_W = 833;
const C1_X = 0;
const C2_X = C1_W; // 833
const C3_X = C1_W + C2_W; // 1667
const ROW_H = 843; // 1686 / 2

const richMenuBody = {
  size: {
    width: 2500,
    height: 1686,
  },
  selected: true,
  name: "barbershop-main-menu-v2",
  chatBarText: "選單",
  areas: [
    // ─── Row 1 ───
    {
      // Top-Left — 立即預約
      bounds: { x: C1_X, y: 0, width: C1_W, height: ROW_H },
      action: {
        type: "uri" as const,
        label: "立即預約",
        uri: `${LIFF_BASE}/booking`,
      },
    },
    {
      // Top-Mid — 我的預約 (message action → dynamic Flex via webhook)
      bounds: { x: C2_X, y: 0, width: C2_W, height: ROW_H },
      action: {
        type: "message" as const,
        label: "我的預約",
        text: "我的預約",
      },
    },
    {
      // Top-Right — 服務項目
      bounds: { x: C3_X, y: 0, width: C3_W, height: ROW_H },
      action: {
        type: "message" as const,
        label: "服務項目",
        text: "服務價目",
      },
    },
    // ─── Row 2 ───
    {
      // Bottom-Left — 💰 匯款 (NEW, 碩展 1.2)
      bounds: { x: C1_X, y: ROW_H, width: C1_W, height: ROW_H },
      action: {
        type: "message" as const,
        label: "匯款",
        text: "匯款", // hits classifyIntent "payment" → paymentGuideMessage Flex
      },
    },
    {
      // Bottom-Mid — ↻ 改/取消 (NEW, 碩展 1.2)
      bounds: { x: C2_X, y: ROW_H, width: C2_W, height: ROW_H },
      action: {
        type: "message" as const,
        label: "改 / 取消",
        text: "改時間", // hits classifyIntent "cancel-reschedule" → my-bookings Flex
      },
    },
    {
      // Bottom-Right — 門市資訊
      bounds: { x: C3_X, y: ROW_H, width: C3_W, height: ROW_H },
      action: {
        type: "uri" as const,
        label: "門市資訊",
        uri: STORE_MAP_URL,
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// API Helpers
// ---------------------------------------------------------------------------

async function apiCall(
  url: string,
  options: RequestInit
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const res = await fetch(url, options);
  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await res.json()
    : await res.text();
  return { ok: res.ok, status: res.status, data };
}

/** List existing rich menus so we can clean up old ones. */
async function listRichMenus(): Promise<{ richMenuId: string; name: string }[]> {
  const { ok, data } = await apiCall(
    "https://api.line.me/v2/bot/richmenu/list",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${LINE_ACCESS_TOKEN}` },
    }
  );
  if (!ok) {
    console.warn("Warning: could not list rich menus:", data);
    return [];
  }
  return (data as { richmenus: { richMenuId: string; name: string }[] })
    .richmenus;
}

/** Delete a rich menu by ID. */
async function deleteRichMenu(richMenuId: string): Promise<void> {
  const { ok, data } = await apiCall(
    `https://api.line.me/v2/bot/richmenu/${richMenuId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${LINE_ACCESS_TOKEN}` },
    }
  );
  if (!ok) {
    console.warn(`Warning: failed to delete rich menu ${richMenuId}:`, data);
  }
}

/** Create the rich menu and return its ID. */
async function createRichMenu(): Promise<string> {
  const { ok, status, data } = await apiCall(
    "https://api.line.me/v2/bot/richmenu",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LINE_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(richMenuBody),
    }
  );
  if (!ok) {
    console.error(`Failed to create rich menu (${status}):`, data);
    process.exit(1);
  }
  return (data as { richMenuId: string }).richMenuId;
}

/** Upload an image for the rich menu. */
async function uploadRichMenuImage(
  richMenuId: string,
  imagePath: string
): Promise<void> {
  const imageBuffer = fs.readFileSync(imagePath);
  const ext = path.extname(imagePath).toLowerCase();
  const contentType = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";

  const { ok, status, data } = await apiCall(
    `https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LINE_ACCESS_TOKEN}`,
        "Content-Type": contentType,
      },
      body: imageBuffer,
    }
  );
  if (!ok) {
    console.error(`Failed to upload rich menu image (${status}):`, data);
    process.exit(1);
  }
}

/** Set a rich menu as default for all users. */
async function setDefaultRichMenu(richMenuId: string): Promise<void> {
  const { ok, status, data } = await apiCall(
    `https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LINE_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );
  if (!ok) {
    console.error(`Failed to set default rich menu (${status}):`, data);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Generate a fallback image using pure SVG → PNG (no Canvas dependency)
// ---------------------------------------------------------------------------

/**
 * Generate a 3×2 (6-cell) SVG rich menu image as fallback.
 * LINE accepts PNG/JPEG; this SVG is a placeholder for design preview.
 * For production, convert to PNG via the HTML generator at docs/rich-menu/.
 */
function generateFallbackSvg(): string {
  const W = 2500;
  const H = 1686;
  const ROW_H_SVG = H / 2;
  const COL_W_SVG = W / 3;
  const PRIMARY = "#003D2B";
  const SURFACE = "#FFF8F1";
  const SURFACE_ALT = "#FBF3E6";

  const cells = [
    // Row 1
    { row: 0, col: 0, bg: PRIMARY, fg: SURFACE, title: "立即預約", subtitle: "BOOK NOW", emoji: "📅" },
    { row: 0, col: 1, bg: SURFACE_ALT, fg: PRIMARY, title: "我的預約", subtitle: "MY BOOKINGS", emoji: "📋" },
    { row: 0, col: 2, bg: SURFACE_ALT, fg: PRIMARY, title: "服務項目", subtitle: "SERVICES", emoji: "✂️" },
    // Row 2
    { row: 1, col: 0, bg: SURFACE_ALT, fg: PRIMARY, title: "💰 匯款", subtitle: "PAYMENT", emoji: "" },
    { row: 1, col: 1, bg: SURFACE_ALT, fg: PRIMARY, title: "↻ 改 / 取消", subtitle: "RESCHEDULE", emoji: "" },
    { row: 1, col: 2, bg: PRIMARY, fg: SURFACE, title: "門市資訊", subtitle: "LOCATION", emoji: "📍" },
  ];

  const cellSvg = cells.map(({ row, col, bg, fg, title, subtitle, emoji }) => {
    const x = col * COL_W_SVG;
    const y = row * ROW_H_SVG;
    const cx = x + COL_W_SVG / 2;
    const cy = y + ROW_H_SVG / 2;
    return `
  <g>
    <rect x="${x}" y="${y}" width="${COL_W_SVG}" height="${ROW_H_SVG}" fill="${bg}"/>
    ${emoji ? `<text x="${cx}" y="${cy - 80}" text-anchor="middle" font-size="120" fill="${fg}">${emoji}</text>` : ""}
    <text x="${cx}" y="${cy + 20}" text-anchor="middle"
          font-family="'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif"
          font-size="64" font-weight="700" fill="${fg}">${title}</text>
    <text x="${cx}" y="${cy + 80}" text-anchor="middle"
          font-family="'Manrope', sans-serif"
          font-size="32" letter-spacing="6" fill="${fg}" opacity="0.6">${subtitle}</text>
  </g>`;
  }).join("");

  // Subtle dividers between cells
  const dividers = `
  <line x1="${COL_W_SVG}" y1="0" x2="${COL_W_SVG}" y2="${H}" stroke="rgba(0,0,0,0.06)" stroke-width="2"/>
  <line x1="${COL_W_SVG * 2}" y1="0" x2="${COL_W_SVG * 2}" y2="${H}" stroke="rgba(0,0,0,0.06)" stroke-width="2"/>
  <line x1="0" y1="${ROW_H_SVG}" x2="${W}" y2="${ROW_H_SVG}" stroke="rgba(0,0,0,0.06)" stroke-width="2"/>
  `;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <!-- 3×2 grid placeholder — swap with branded artwork before production deploy -->
  ${cellSvg}
  ${dividers}
</svg>`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== LINE Rich Menu Setup ===\n");

  // Parse --image argument
  const imageArgIdx = process.argv.indexOf("--image");
  let imagePath: string | null =
    imageArgIdx !== -1 ? process.argv[imageArgIdx + 1] : null;

  // Step 1: Clean up old rich menus with the same name
  console.log("1. Checking for existing rich menus...");
  const existing = await listRichMenus();
  const old = existing.filter((m) => m.name === "barbershop-main-menu");
  if (old.length > 0) {
    console.log(`   Found ${old.length} existing menu(s) to replace.`);
    for (const menu of old) {
      console.log(`   Deleting: ${menu.richMenuId}`);
      await deleteRichMenu(menu.richMenuId);
    }
  } else {
    console.log("   No existing menus to clean up.");
  }

  // Step 2: Create the rich menu
  console.log("\n2. Creating rich menu...");
  console.log(`   LIFF booking URL: ${LIFF_BASE}/booking`);
  console.log(`   LIFF my-bookings URL: ${LIFF_BASE}/my-bookings`);
  const richMenuId = await createRichMenu();
  console.log(`   Created: ${richMenuId}`);

  // Step 3: Upload the image
  console.log("\n3. Uploading rich menu image...");

  if (!imagePath) {
    // Generate fallback SVG → save as temp file
    // LINE requires PNG or JPEG, so we generate an SVG and convert using a note
    const svgContent = generateFallbackSvg();
    const svgPath = path.join(__dirname, "rich-menu-fallback.svg");
    fs.writeFileSync(svgPath, svgContent, "utf-8");
    console.log(`   Generated fallback SVG: ${svgPath}`);
    console.log("");
    console.log("   WARNING: LINE requires PNG or JPEG images.");
    console.log("   The SVG has been saved but cannot be uploaded directly.");
    console.log("");
    console.log("   To generate a proper PNG image:");
    console.log("     1. Open scripts/generate-rich-menu-image.html in a browser");
    console.log('     2. Click "Save as PNG"');
    console.log("     3. Re-run: npx tsx scripts/setup-rich-menu.ts --image path/to/image.png");
    console.log("");
    console.log("   Or convert the SVG:");
    console.log(`     npx @anthropic-ai/svg2png ${svgPath} -o scripts/rich-menu.png -w 2500 -h 843`);
    console.log("     npx tsx scripts/setup-rich-menu.ts --image scripts/rich-menu.png");
    console.log("");

    // Try to find a default image in common locations
    const defaultLocations = [
      path.join(__dirname, "rich-menu.png"),
      path.join(__dirname, "..", "public", "rich-menu.png"),
      path.join(__dirname, "rich-menu.jpg"),
    ];
    for (const loc of defaultLocations) {
      if (fs.existsSync(loc)) {
        imagePath = loc;
        console.log(`   Found existing image: ${loc}`);
        break;
      }
    }
  }

  if (imagePath) {
    if (!fs.existsSync(imagePath)) {
      console.error(`   ERROR: Image file not found: ${imagePath}`);
      console.log(`\n   Rich menu ${richMenuId} was created but has NO image.`);
      console.log("   Upload an image and set as default manually, or re-run this script.\n");
      console.log("   To delete this menu:");
      console.log(`   curl -X DELETE https://api.line.me/v2/bot/richmenu/${richMenuId} \\`);
      console.log(`     -H "Authorization: Bearer $LINE_CHANNEL_ACCESS_TOKEN"`);
      process.exit(1);
    }
    await uploadRichMenuImage(richMenuId, imagePath);
    console.log("   Image uploaded successfully.");
  } else {
    console.log("   Skipping image upload (no PNG provided).");
    console.log(`   Rich menu ID: ${richMenuId}`);
    console.log("   You can upload later with:");
    console.log(`   curl -X POST https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content \\`);
    console.log(`     -H "Authorization: Bearer $LINE_CHANNEL_ACCESS_TOKEN" \\`);
    console.log('     -H "Content-Type: image/png" \\');
    console.log("     --data-binary @scripts/rich-menu.png");
    console.log("");
    console.log("   Then set as default:");
    console.log(`   curl -X POST https://api.line.me/v2/bot/user/all/richmenu/${richMenuId} \\`);
    console.log(`     -H "Authorization: Bearer $LINE_CHANNEL_ACCESS_TOKEN"`);
    return;
  }

  // Step 4: Set as default
  console.log("\n4. Setting as default rich menu for all users...");
  await setDefaultRichMenu(richMenuId);
  console.log("   Done! Rich menu is now active for all users.");

  // Summary
  console.log("\n=== Setup Complete ===");
  console.log(`Rich Menu ID: ${richMenuId}`);
  console.log("Layout: 2500x1686 (3 cols × 2 rows, 6 cells)");
  console.log(`  Row 1: [立即預約] [我的預約] [服務項目]`);
  console.log(`  Row 2: [💰 匯款]  [↻ 改/取消] [門市資訊]`);
  console.log("");
  console.log(`  立即預約    → ${LIFF_BASE}/booking`);
  console.log(`  我的預約    → keyword "我的預約" → dynamic Flex`);
  console.log(`  服務項目    → keyword "服務價目" → pricing carousel`);
  console.log(`  💰 匯款     → keyword "匯款" → payment guide Flex`);
  console.log(`  ↻ 改/取消   → keyword "改時間" → my-bookings Flex with reschedule/cancel`);
  console.log(`  門市資訊    → ${STORE_MAP_URL}`);
  console.log("");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
