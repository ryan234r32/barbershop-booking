/**
 * SWR localStorage cache provider.
 *
 * Survives PWA close → reopen, so the user sees cached data instantly on
 * cold start (SWR then revalidates in the background). Big quality-of-life
 * win for the admin app where the same endpoints are hit repeatedly across
 * sessions (reports, customers, calendar, coupons, etc.).
 *
 * Cache key: `swr-cache-v{N}`. Bump N when an API response shape changes
 * to invalidate stale cached payloads on next load.
 */

import type { Cache } from "swr";

const CACHE_KEY = "swr-cache-v1";
const MAX_CACHE_BYTES = 2_000_000; // ~2MB; localStorage quota is 5-10MB

type CacheEntry = [string, unknown];

export function localStorageProvider(): Cache {
  if (typeof window === "undefined") return new Map();

  let entries: CacheEntry[] = [];
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) entries = JSON.parse(raw) as CacheEntry[];
  } catch {
    // Corrupt cache or JSON — ignore, start fresh
  }

  const map = new Map<string, unknown>(entries);

  const save = () => {
    try {
      const serialized = JSON.stringify(Array.from(map.entries()));
      if (serialized.length > MAX_CACHE_BYTES) {
        // Cache too large — drop oldest half (keys are insertion-ordered)
        const half = Math.floor(map.size / 2);
        let i = 0;
        for (const key of map.keys()) {
          if (i++ >= half) break;
          map.delete(key);
        }
      }
      localStorage.setItem(CACHE_KEY, JSON.stringify(Array.from(map.entries())));
    } catch {
      // Quota exceeded or storage disabled — silently drop
    }
  };

  // pagehide fires reliably on mobile when the tab is closed, swiped away,
  // or backgrounded for long enough that Safari/iOS may discard the page.
  // beforeunload is unreliable on mobile — pagehide is the modern recommendation.
  window.addEventListener("pagehide", save);
  // Also save on visibility change to "hidden" — covers PWA going to background.
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") save();
  });

  // Map is structurally compatible with SWR's Cache interface (get/set/delete/keys),
  // but the strict generic parameters don't unify. Cast through unknown.
  return map as unknown as Cache;
}
