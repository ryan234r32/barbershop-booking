/**
 * Push the profile-completion LIFF form to ADMIN_LINE_USER_ID for preview.
 *
 * Run:
 *   npx tsx scripts/send-profile-form-preview.ts
 *
 * Env required:
 *   - LINE_CHANNEL_ACCESS_TOKEN
 *   - NEXT_PUBLIC_LIFF_ID
 *   - ADMIN_LINE_USER_ID
 *
 * Sends both:
 *   1. A LIFF deep-link the admin can tap to open the form (works in LINE app)
 *   2. A short usage note describing where the data ends up in the backend
 */

import "dotenv/config";
import { Client } from "@line/bot-sdk";

const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
const adminUserId = process.env.ADMIN_LINE_USER_ID;

function bail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

if (!accessToken) bail("LINE_CHANNEL_ACCESS_TOKEN missing");
if (!liffId) bail("NEXT_PUBLIC_LIFF_ID missing");
if (!adminUserId) bail("ADMIN_LINE_USER_ID missing");

const liffUrl = `https://liff.line.me/${liffId}/profile`;

const client = new Client({
  channelAccessToken: accessToken!,
  channelSecret: process.env.LINE_CHANNEL_SECRET || "",
});

async function main() {
  console.log(`→ pushing profile form preview to ${adminUserId}`);
  console.log(`→ LIFF URL: ${liffUrl}\n`);

  await client.pushMessage(adminUserId!, [
    {
      type: "text",
      text: `📋 會員資料表單預覽\n\n點下面連結開啟（在 LINE 內），看看客人填寫流程：\n${liffUrl}`,
    },
    {
      type: "flex",
      altText: "會員資料表單預覽",
      contents: {
        type: "bubble",
        size: "kilo",
        body: {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            {
              type: "text",
              text: "完善會員資料",
              weight: "bold",
              size: "md",
              color: "#003D2B",
            },
            {
              type: "text",
              text: "30 秒填寫，享生日當月優惠",
              size: "xs",
              color: "#666666",
              wrap: true,
            },
            {
              type: "separator",
              margin: "md",
            },
            {
              type: "text",
              text: "🔒 我們不會發行銷簡訊",
              size: "xs",
              color: "#003D2B",
              margin: "md",
            },
            {
              type: "text",
              text: "手機只用來傳預約提醒",
              size: "xs",
              color: "#666666",
            },
            {
              type: "text",
              text: "生日只用於生日月優惠",
              size: "xs",
              color: "#666666",
            },
          ],
        },
        footer: {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            {
              type: "button",
              style: "primary",
              color: "#003D2B",
              action: {
                type: "uri",
                label: "開始填寫",
                uri: liffUrl,
              },
            },
          ],
        },
      },
    },
  ]);

  console.log("✓ pushed");
  console.log("\n資料流：");
  console.log("  客人填表 → POST /api/profile/me （X-LIFF-ID-Token 驗身分）");
  console.log("  → 寫入 User.phone / birthday / gender / realName");
  console.log("  → 若填了「之前在店裡用的名字」+ 唯一符合 → 自動合併舊客紀錄");
  console.log("  → 後台 /customers/[id] 立即看得到");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("✗ failed:", err);
    process.exit(1);
  });
