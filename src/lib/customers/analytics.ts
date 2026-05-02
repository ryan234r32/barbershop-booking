/**
 * Customer composition analytics — aggregates User table for the admin
 * `/customers?view=analytics` dashboard. Mirrors the 夯客 reference design:
 * total / verified / unverified totals + cross-tab of age × {gender,
 * verification, visit-tier}.
 *
 * - "Verified" = `profileCompletedAt !== null` (customer self-filled phone via
 *   LIFF /profile, which is also the launch-lottery gate).
 * - "Visit tier" buckets totalVisits into 新客 (≤1) / 2次客 (=2) / 3+次客 (≥3).
 * - Age buckets are inclusive labels matching the dashboard table.
 */

import { prisma } from "@/lib/prisma";

export const AGE_BUCKETS = [
  { key: "under16", label: "16歲以下", min: 0, max: 16 },
  { key: "17-20", label: "17-20歲", min: 17, max: 20 },
  { key: "21-25", label: "21-25歲", min: 21, max: 25 },
  { key: "26-30", label: "26-30歲", min: 26, max: 30 },
  { key: "31-35", label: "31-35歲", min: 31, max: 35 },
  { key: "36-40", label: "36-40歲", min: 36, max: 40 },
  { key: "41-50", label: "41-50歲", min: 41, max: 50 },
  { key: "over50", label: "51歲以上", min: 51, max: 200 },
  { key: "unknown", label: "未提供", min: -1, max: -1 },
] as const;

export type AgeBucketKey = (typeof AGE_BUCKETS)[number]["key"];

export interface GenderCounts {
  female: number;
  male: number;
  other: number;
  unspecified: number;
}

export interface VerificationCounts {
  verified: number;
  unverified: number;
}

export interface VisitTierCounts {
  /** totalVisits ≤ 1 — first-time / not-yet-visited */
  new: number;
  /** totalVisits === 2 */
  twice: number;
  /** totalVisits ≥ 3 */
  threePlus: number;
}

export interface AgeBucketRow {
  key: AgeBucketKey;
  label: string;
  total: number;
  gender: GenderCounts;
  verification: VerificationCounts;
  visitTier: VisitTierCounts;
}

export interface CustomerAnalytics {
  totals: {
    total: number;
    verified: number;
    unverified: number;
  };
  composition: {
    gender: GenderCounts;
    verification: VerificationCounts;
    visitTier: VisitTierCounts;
  };
  ageBuckets: AgeBucketRow[];
}

function emptyGender(): GenderCounts {
  return { female: 0, male: 0, other: 0, unspecified: 0 };
}

function emptyVerification(): VerificationCounts {
  return { verified: 0, unverified: 0 };
}

function emptyVisitTier(): VisitTierCounts {
  return { new: 0, twice: 0, threePlus: 0 };
}

function ageFromBirthday(birthday: Date, today: Date): number {
  let age = today.getUTCFullYear() - birthday.getUTCFullYear();
  const monthDiff = today.getUTCMonth() - birthday.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < birthday.getUTCDate())) {
    age -= 1;
  }
  return age;
}

function bucketForAge(age: number | null): AgeBucketKey {
  if (age === null || age < 0) return "unknown";
  for (const b of AGE_BUCKETS) {
    if (b.key === "unknown") continue;
    if (age >= b.min && age <= b.max) return b.key;
  }
  return "unknown";
}

function genderKey(gender: string | null): keyof GenderCounts {
  if (gender === "FEMALE") return "female";
  if (gender === "MALE") return "male";
  if (gender === "OTHER") return "other";
  return "unspecified";
}

function visitTierKey(totalVisits: number): keyof VisitTierCounts {
  if (totalVisits <= 1) return "new";
  if (totalVisits === 2) return "twice";
  return "threePlus";
}

export async function getCustomerAnalytics(tenantId: string): Promise<CustomerAnalytics> {
  const users = await prisma.user.findMany({
    where: { tenantId },
    select: {
      gender: true,
      birthday: true,
      totalVisits: true,
      profileCompletedAt: true,
    },
  });

  const today = new Date();

  const totals = { total: users.length, verified: 0, unverified: 0 };
  const composition = {
    gender: emptyGender(),
    verification: emptyVerification(),
    visitTier: emptyVisitTier(),
  };

  const bucketMap = new Map<AgeBucketKey, AgeBucketRow>();
  for (const b of AGE_BUCKETS) {
    bucketMap.set(b.key, {
      key: b.key,
      label: b.label,
      total: 0,
      gender: emptyGender(),
      verification: emptyVerification(),
      visitTier: emptyVisitTier(),
    });
  }

  for (const u of users) {
    const verified = u.profileCompletedAt !== null;
    const verifKey: keyof VerificationCounts = verified ? "verified" : "unverified";
    const gKey = genderKey(u.gender);
    const vKey = visitTierKey(u.totalVisits);

    if (verified) totals.verified += 1;
    else totals.unverified += 1;

    composition.gender[gKey] += 1;
    composition.verification[verifKey] += 1;
    composition.visitTier[vKey] += 1;

    const age = u.birthday ? ageFromBirthday(u.birthday, today) : null;
    const bucket = bucketMap.get(bucketForAge(age))!;
    bucket.total += 1;
    bucket.gender[gKey] += 1;
    bucket.verification[verifKey] += 1;
    bucket.visitTier[vKey] += 1;
  }

  return {
    totals,
    composition,
    ageBuckets: Array.from(bucketMap.values()),
  };
}
