import "dotenv/config";
import pg from "pg";

const updates: Array<{ name: string; description: string; imageUrl: string }> = [
  { name: "男性剪髮", description: "洗髮 · 精修剪裁 · 造型完成", imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuCSe5e9V_7P52xeGYH5d9tVZsQmOOGdgXMx27NT_Gf1U3awXzjOyC9Ykkml4e2uCP3uEhZ3MWQpfq-5dJI1Rvwe_XwPae_tPSeqia9pzZY-0DB5CYnasDSvSUu07-ch_QBH7s4x3YgU6b-4vmw6NhLzrogrlcZcMP6Kl6LePVK4sTdC1npEjNI2NXmezVfdpbJ6JY4JHvuq37-O4b9y_SeI5FV56qFegxmREHQMLGWFNMh4aiaQygQ55F-OyFog_Q6D07kL64_IMA" },
  { name: "女性剪髮", description: "洗髮 · 剪裁設計 · 吹整造型", imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuB0o0kP1XoPVH99B0cLp_JnGA1qwoORO029Ee3PMzJ0R9MM2Ud4SQMvpxkL5aPXqwoOazPYJeY3Q8JkTfb8GmFfTjoL2-b48HDwN8DrCAl8_QHrTCObeND8GD3194QSRq-x5eNlj05DG_UFfCtUSZxTPcKEKGWpyhm7QiVUkql_8gXchUE0VZ4E-qSGpfUkqxNseB7xUtQ_IdeQe36H83zsk6R7fIBiix7G5dLkk8MYMac-YkBpB_5ytpIZhC1i4CCFSU-0KhlDBw" },
  { name: "補染", description: "髮根補色，維持整體色澤一致", imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuA15VoHn9oqZpv4gF-GCxCLvoj6dVNdgavshCc3ybuFYNCGIjXV6vCg5zXu6kEHUhiJ4sduA7jHZ3gKU-l4OohitMT2Bk7NyYcLPrCN_NivYEkq8136dDwEfqVDnZyuc5a2cIQY8dM4k_6-cPxRzhieKo5wdgeqkWJyGdLrONsROOdUs0wgDCInVHe7g_5WKWVteZp0tRkbAL9mVjdwH0Nr9tPBo1ZS8J2vZarJdOHSAWqMnVjfe195aCwmypVJOTSpgkPETosXMQ" },
  { name: "漂髮", description: "專業漂色處理，依髮長定價", imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuDGO-my3Q_gYcNT8XvtwBWa1RqZjupQPJeWgGvuDwZSXztb1vIU-V__63yuZt7aFOCM6G3aT6ykymYqdqIL-KcZrrjsz8j2vkjvpsM9Y1U497CneZfdi2zlmDjOJVBEHplQTLvkauCUKchUbPLaGkmmyM_KoH1yHrG2mRMy_jqnmoqwFDiR81Y5MBWH7Y7dalHGdnCiuUakjqF2CRNebEWOVXb5NsnkVFqSydlE7gCxOgcPfCsDvYKQ2kl_TGqS-EBHZEDIjbamCA" },
  { name: "染髮", description: "全頭染色，打造專屬髮色", imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuCSyayKzq7GS3vgnM_nIJYVIl2ny325nsQqPWPxhFVnPgEcSmRT0g_KDcnnCd5yAhn_8QNj8MyLG5F4NYvMnuAtPVwOE11VKjbjHaQlSXPnIGzb8BeLlGpsk3Qw6y9kIPcpmEMk5tJCW7qAooAGU5YshdPJU8OrS7pCiryH6dxeUw6zf1VgFN1KGuYbQagrJGkGBOdoLOMnXzsZMJeaWkhtJ37O7g_av66nuPEunKw1ZzzH7Im5DZNGTEcxLsfX7aINF51Jk_GPyA" },
  { name: "溫塑燙", description: "溫感塑型，打造自然捲度", imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuB7uC6f6r0fuWO8CHTrSQAi6BEsllbQ4rZKQ-4FJUUX6Ybnsyr5SkWNVqkWvWZCnRML5dfm2WAqvswEXYlkPrpzgcIaNtAr4yFFZ9s9pKLqD38RESdlMc7PKg40YP9qhCzDCmuNnCQpV9DX2OUuaXO9hGZvRxQEkFRSYj5xKCNhsyx4l0KQATEpNAtisLrseeCLYCy0S1__sP0hs3ktNLbXAu5sPiAjXMprFIAItVitRpgfR9HHkjw08B_K1aqMWxAjMMwcsElxAQ" },
  { name: "縮毛矯正", description: "日式結構矯正，根除毛躁", imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuAwzMVMwegEnbDvvRSKvsoW6zD2ouj4HDAOszPS20HzkDLlLJ4EqnRuyBYMQ_SjASiovUaFqj-fXLyu6fQ9s8s2bdFbJpNR5pL6xJxafY54Y2BopCM32riKPtfmAtx0-4CeJyDZzTY6E3jaNILmvgoO988l-XAHejMMuk7etSaTQUmRRfMMAwIKt2UVqPi_625DNqrL1qPJ9___acmgieyzBRmfuf53EvZUzJGKmCo9TdA7OyfHCqslvPrJkY984RzXr9Xz-acCXA" },
  { name: "結構式護髮", description: "深層修護，重建髮絲結構", imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuA14fFGQC4zEyUTT7f_oeYTZrB8MAgu4xsDpRvBxOsMGE9NHCyOLNkaosFIBl-ZCSe5As6KOiDKLryH8upBHhvjUA8EibAvDstKQTmLlhijLJW15fkFooAEMWNUGfXcRy0m69Sn2SuAzNtg5RfbdbvZqdALkm-dcsooTptpk1rCoyuk1is6HiP14Z8ln4IlqCMoQbTlhmVrW47VGiCREf1-S8DggNpIyiosBcO4dj10JXUpN5EXE3f4byFGSpGouaYm7WVi6ndafA" },
  { name: "頭皮調理", description: "義大利專業頭皮健康管理", imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuBRZsgpvwCc2EZxJLtblZ1iuuXReCX-WB8VmTnHAdKLUoX-LW4V-Po0MiKADJ_01-QvBKF1yEFzwX_we0KFKjHVijYeC-HzmKsORVo090i5IqosZ4oXsM6Gfwn-ZvubGCvl5K7a_gAbEOOx1b74AnbBB2CTx1W_mCGlfJXZ0RWbQwB23qwWQvy_tn4xPorh6Ib_mbcldZEJ03jEwURG2ZMoFzBSiVkg8evkQdfBwbB4CLg0i0aKE9lXRMLYk8UE397QwiE26Vi-bg" },
];

async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log("Connected to database");

  // Step 1: Add column if not exists
  await client.query(`ALTER TABLE services ADD COLUMN IF NOT EXISTS image_url TEXT`);
  console.log("✅ image_url column ensured");

  // Step 2: Update each service
  for (const u of updates) {
    const result = await client.query(
      `UPDATE services SET image_url = $1, description = $2 WHERE name = $3`,
      [u.imageUrl, u.description, u.name]
    );
    console.log(`${u.name}: updated ${result.rowCount} rows`);
  }

  // Step 3: Verify
  const { rows } = await client.query(
    `SELECT name, image_url IS NOT NULL as has_image, description FROM services ORDER BY sort_order`
  );
  console.log("\n--- Verification ---");
  for (const r of rows) {
    console.log(`${r.name}: image=${r.has_image ? "✅" : "❌"} desc="${r.description}"`);
  }

  await client.end();
  console.log("\n✅ Done!");
}
main();
