/**
 * Rich Menu Setup Script for LINE Barbershop Booking Bot
 *
 * Creates a 2×2 Rich Menu with 4 buttons (post-訪談 1.2 redesign — 匯款資訊
 * replaces 門市資訊 in BR; 門市地圖改放歡迎訊息 + Flex 卡片 footer):
 *   Top-Left     — "立即預約"   → opens LIFF booking page
 *   Top-Right    — "我的預約"   → sends "我的預約" (dynamic Flex via webhook)
 *   Bottom-Left  — "服務項目"   → sends "服務價目" → pricing carousel
 *   Bottom-Right — "匯款資訊"   → sends "匯款" → payment guide Flex (amount = 該客最近一筆 booking)
 *
 * Usage:
 *   npx tsx scripts/setup-rich-menu.ts
 *   npx tsx scripts/setup-rich-menu.ts --image path/to/rich-menu.png
 *
 * Prerequisites:
 *   - .env with LINE_CHANNEL_ACCESS_TOKEN and NEXT_PUBLIC_LIFF_ID
 *   - A 2500x1686 PNG image saved at scripts/rich-menu.png (or pass --image)
 *
 * Layout: 2500x1686, 2 cols × 2 rows, 1250 wide × 843 high per cell
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

// (門市地圖連結原本給 Rich Menu BR 用，4-cell 改版後改放歡迎訊息 + Flex 卡片
// footer 由 src/lib/line/messages.ts 內部處理；此檔不再需要。)

// ---------------------------------------------------------------------------
// Rich Menu Definition (2×2 grid: 2500x1686, 2 cols × 2 rows)
// 4-cell layout, BR = 匯款資訊 (post-訪談 1.2 redesign)
// ---------------------------------------------------------------------------

const COL_W = 1250; // 2500 / 2
const ROW_H = 843;  // 1686 / 2
const COL_L_X = 0;
const COL_R_X = COL_W; // 1250

const richMenuBody = {
  size: {
    width: 2500,
    height: 1686,
  },
  selected: true,
  name: "barbershop-main-menu-v3",
  chatBarText: "選單",
  areas: [
    // ─── Row 1 ───
    {
      // Top-Left — 立即預約 (深綠底)
      bounds: { x: COL_L_X, y: 0, width: COL_W, height: ROW_H },
      action: {
        type: "uri" as const,
        label: "立即預約",
        uri: `${LIFF_BASE}/booking`,
      },
    },
    {
      // Top-Right — 我的預約 (米色底)
      bounds: { x: COL_R_X, y: 0, width: COL_W, height: ROW_H },
      action: {
        type: "message" as const,
        label: "我的預約",
        text: "我的預約",
      },
    },
    // ─── Row 2 ───
    {
      // Bottom-Left — 服務項目 (米色底)
      bounds: { x: COL_L_X, y: ROW_H, width: COL_W, height: ROW_H },
      action: {
        type: "message" as const,
        label: "服務項目",
        text: "服務價目",
      },
    },
    {
      // Bottom-Right — 匯款資訊 (深棕底)
      bounds: { x: COL_R_X, y: ROW_H, width: COL_W, height: ROW_H },
      action: {
        type: "message" as const,
        label: "匯款資訊",
        text: "匯款", // hits classifyIntent "payment" → paymentGuideMessage Flex
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
 * Generate a 2×2 (4-cell) SVG rich menu image as fallback.
 * LINE accepts PNG/JPEG; this SVG is a placeholder for design preview.
 * Production artwork lives at scripts/rich-menu.png.
 */
function generateFallbackSvg(): string {
  const W = 2500;
  const H = 1686;
  const ROW_H_SVG = H / 2;
  const COL_W_SVG = W / 2;
  const PRIMARY = "#003D2B";   // Forest Green
  const SURFACE = "#FAF1E0";   // Cream Beige
  const CHARCOAL = "#3D3733";  // Warm Charcoal Brown

  const cells = [
    // Row 1
    { row: 0, col: 0, bg: PRIMARY,  fg: SURFACE, title: "立即預約", subtitle: "BOOK NOW" },
    { row: 0, col: 1, bg: SURFACE,  fg: PRIMARY, title: "我的預約", subtitle: "MY BOOKINGS" },
    // Row 2
    { row: 1, col: 0, bg: SURFACE,  fg: PRIMARY, title: "服務項目", subtitle: "SERVICES" },
    { row: 1, col: 1, bg: CHARCOAL, fg: SURFACE, title: "匯款資訊", subtitle: "PAYMENT" },
  ];

  const cellSvg = cells.map(({ row, col, bg, fg, title, subtitle }) => {
    const x = col * COL_W_SVG;
    const y = row * ROW_H_SVG;
    const cx = x + COL_W_SVG / 2;
    const cy = y + ROW_H_SVG / 2;
    return `
  <g>
    <rect x="${x}" y="${y}" width="${COL_W_SVG}" height="${ROW_H_SVG}" fill="${bg}"/>
    <text x="${cx}" y="${cy + 20}" text-anchor="middle"
          font-family="'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif"
          font-size="120" font-weight="700" fill="${fg}">${title}</text>
    <text x="${cx}" y="${cy + 110}" text-anchor="middle"
          font-family="'Manrope', sans-serif"
          font-size="48" letter-spacing="8" fill="${fg}" opacity="0.6">${subtitle}</text>
  </g>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <!-- 2×2 grid placeholder — production artwork at scripts/rich-menu.png -->
  ${cellSvg}
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
  const old = existing.filter((m) =>
    m.name === "barbershop-main-menu" ||
    m.name === "barbershop-main-menu-v2" ||
    m.name === "barbershop-main-menu-v3"
  );
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
  console.log("Layout: 2500x1686 (2 cols × 2 rows, 4 cells)");
  console.log(`  Row 1: [立即預約]   [我的預約]`);
  console.log(`  Row 2: [服務項目]   [匯款資訊]`);
  console.log("");
  console.log(`  立即預約  → ${LIFF_BASE}/booking`);
  console.log(`  我的預約  → keyword "我的預約" → dynamic Flex`);
  console.log(`  服務項目  → keyword "服務價目" → pricing carousel`);
  console.log(`  匯款資訊  → keyword "匯款" → payment guide Flex (帶該客最近一筆 booking 金額)`);
  console.log("");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
