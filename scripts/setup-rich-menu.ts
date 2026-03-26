/**
 * Rich Menu Setup Script for LINE Barbershop Booking Bot
 *
 * Creates a Rich Menu with 3 buttons:
 *   Left   — "立即預約" → opens LIFF booking page
 *   Center — "我的預約" → opens LIFF my-bookings page
 *   Right  — "服務價目" → sends text "服務" to trigger keyword reply
 *
 * Usage:
 *   npx tsx scripts/setup-rich-menu.ts
 *   npx tsx scripts/setup-rich-menu.ts --image path/to/rich-menu.png
 *
 * Prerequisites:
 *   - .env with LINE_CHANNEL_ACCESS_TOKEN and NEXT_PUBLIC_LIFF_ID
 *   - A 2500x843 PNG image (generate one with scripts/generate-rich-menu-image.html)
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

// ---------------------------------------------------------------------------
// Rich Menu Definition (compact: 2500x843, 3 columns, 1 row)
// ---------------------------------------------------------------------------

const richMenuBody = {
  size: {
    width: 2500,
    height: 843,
  },
  selected: true,
  name: "barbershop-main-menu",
  chatBarText: "選單",
  areas: [
    {
      // Left column — 立即預約
      bounds: { x: 0, y: 0, width: 833, height: 843 },
      action: {
        type: "uri" as const,
        label: "立即預約",
        uri: `${LIFF_BASE}/booking`,
      },
    },
    {
      // Center column — 我的預約
      bounds: { x: 833, y: 0, width: 834, height: 843 },
      action: {
        type: "uri" as const,
        label: "我的預約",
        uri: `${LIFF_BASE}/my-bookings`,
      },
    },
    {
      // Right column — 服務價目
      bounds: { x: 1667, y: 0, width: 833, height: 843 },
      action: {
        type: "message" as const,
        label: "服務價目",
        text: "服務",
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
 * Generate a minimal SVG rich menu image and return it as a Buffer.
 * This is a fallback when no --image flag is provided.
 * LINE accepts PNG/JPEG; we generate an SVG and note that the user
 * should use the HTML generator for a polished result.
 */
function generateFallbackSvg(): string {
  const W = 2500;
  const H = 843;
  const COL = W / 3;
  const GREEN = "#1DB446";

  // Simple calendar icon path (left button)
  const calendarIcon = `
    <rect x="${COL * 0 + COL / 2 - 40}" y="200" width="80" height="70" rx="8"
          fill="none" stroke="white" stroke-width="5"/>
    <line x1="${COL * 0 + COL / 2 - 40}" y1="220" x2="${COL * 0 + COL / 2 + 40}" y2="220"
          stroke="white" stroke-width="5"/>
    <line x1="${COL * 0 + COL / 2 - 20}" y1="185" x2="${COL * 0 + COL / 2 - 20}" y2="208"
          stroke="white" stroke-width="5" stroke-linecap="round"/>
    <line x1="${COL * 0 + COL / 2 + 20}" y1="185" x2="${COL * 0 + COL / 2 + 20}" y2="208"
          stroke="white" stroke-width="5" stroke-linecap="round"/>
  `;

  // Simple clipboard icon (center button)
  const clipboardIcon = `
    <rect x="${COL * 1 + COL / 2 - 35}" y="195" width="70" height="80" rx="8"
          fill="none" stroke="white" stroke-width="5"/>
    <rect x="${COL * 1 + COL / 2 - 20}" y="185" width="40" height="20" rx="4"
          fill="none" stroke="white" stroke-width="5"/>
    <line x1="${COL * 1 + COL / 2 - 18}" y1="235" x2="${COL * 1 + COL / 2 + 18}" y2="235"
          stroke="white" stroke-width="4"/>
    <line x1="${COL * 1 + COL / 2 - 18}" y1="255" x2="${COL * 1 + COL / 2 + 18}" y2="255"
          stroke="white" stroke-width="4"/>
  `;

  // Simple price tag icon (right button)
  const priceIcon = `
    <circle cx="${COL * 2 + COL / 2}" cy="220" r="35"
            fill="none" stroke="white" stroke-width="5"/>
    <text x="${COL * 2 + COL / 2}" y="230" text-anchor="middle"
          font-size="36" font-weight="bold" fill="white">$</text>
  `;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <!-- Background -->
  <rect width="${W}" height="${H}" fill="${GREEN}"/>

  <!-- Column dividers (subtle) -->
  <line x1="${COL}" y1="60" x2="${COL}" y2="${H - 60}"
        stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
  <line x1="${COL * 2}" y1="60" x2="${COL * 2}" y2="${H - 60}"
        stroke="rgba(255,255,255,0.2)" stroke-width="2"/>

  <!-- Icons -->
  ${calendarIcon}
  ${clipboardIcon}
  ${priceIcon}

  <!-- Labels -->
  <text x="${COL * 0 + COL / 2}" y="370" text-anchor="middle"
        font-family="'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif"
        font-size="56" font-weight="700" fill="white">立即預約</text>

  <text x="${COL * 1 + COL / 2}" y="370" text-anchor="middle"
        font-family="'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif"
        font-size="56" font-weight="700" fill="white">我的預約</text>

  <text x="${COL * 2 + COL / 2}" y="370" text-anchor="middle"
        font-family="'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif"
        font-size="56" font-weight="700" fill="white">服務價目</text>

  <!-- Sub-labels -->
  <text x="${COL * 0 + COL / 2}" y="420" text-anchor="middle"
        font-family="'Noto Sans TC', sans-serif"
        font-size="32" fill="rgba(255,255,255,0.8)">Book Now</text>

  <text x="${COL * 1 + COL / 2}" y="420" text-anchor="middle"
        font-family="'Noto Sans TC', sans-serif"
        font-size="32" fill="rgba(255,255,255,0.8)">My Bookings</text>

  <text x="${COL * 2 + COL / 2}" y="420" text-anchor="middle"
        font-family="'Noto Sans TC', sans-serif"
        font-size="32" fill="rgba(255,255,255,0.8)">Services</text>
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
  console.log("Layout: 2500x843 (compact), 3 columns");
  console.log(`  [立即預約] → ${LIFF_BASE}/booking`);
  console.log(`  [我的預約] → ${LIFF_BASE}/my-bookings`);
  console.log('  [服務價目] → sends "服務" (triggers pricing carousel)');
  console.log("");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
