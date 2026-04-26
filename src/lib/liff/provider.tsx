"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Liff } from "@line/liff";

interface LiffContextType {
  liff: Liff | null;
  isLoggedIn: boolean;
  isInClient: boolean;
  isReady: boolean;
  error: string | null;
  userId: string | null;
  displayName: string | null;
  pictureUrl: string | null;
  realName: string | null;
  phone: string | null;
  birthday: string | null;
  /** Cached LINE ID token. Use this for X-LIFF-ID-Token header without waiting
      for liff.getIDToken() (which requires SDK fully loaded). */
  cachedIdToken: string | null;
}

const defaultState: LiffContextType = {
  liff: null,
  isLoggedIn: false,
  isInClient: false,
  isReady: false,
  error: null,
  userId: null,
  displayName: null,
  pictureUrl: null,
  realName: null,
  phone: null,
  birthday: null,
  cachedIdToken: null,
};

const LiffContext = createContext<LiffContextType>(defaultState);

export function useLiff() {
  return useContext(LiffContext);
}

// Session-scoped optimistic cache. LIFF init averages 2-5s in LINE WebView;
// caching profile + idToken across page navigations within a session lets
// downstream pages (my-bookings etc.) fire API calls immediately on mount
// instead of waiting for full SDK boot.
const LIFF_CACHE_KEY = "liff:cache:v1";
const LIFF_CACHE_TTL_MS = 30 * 60_000; // 30 min — well within LINE ID token's 1h lifetime

interface CachedLiffData {
  ts: number;
  userId: string;
  displayName: string | null;
  pictureUrl: string | null;
  realName: string | null;
  phone: string | null;
  birthday: string | null;
  isLoggedIn: boolean;
  isInClient: boolean;
  cachedIdToken: string | null;
}

function readLiffCache(): CachedLiffData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(LIFF_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedLiffData;
    if (Date.now() - parsed.ts > LIFF_CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeLiffCache(data: Omit<CachedLiffData, "ts">): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      LIFF_CACHE_KEY,
      JSON.stringify({ ts: Date.now(), ...data } satisfies CachedLiffData),
    );
  } catch {
    /* quota exceeded — silent */
  }
}

export function LiffProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LiffContextType>(() => {
    // Optimistic init: if a recent profile is cached in sessionStorage, paint
    // immediately as isReady=true. Real LIFF SDK still loads in the background
    // and overwrites state when done (with fresh idToken).
    const cached = readLiffCache();
    if (!cached) return defaultState;
    return {
      ...defaultState,
      isLoggedIn: cached.isLoggedIn,
      isInClient: cached.isInClient,
      isReady: true,
      userId: cached.userId,
      displayName: cached.displayName,
      pictureUrl: cached.pictureUrl,
      realName: cached.realName,
      phone: cached.phone,
      birthday: cached.birthday,
      cachedIdToken: cached.cachedIdToken,
    };
  });

  useEffect(() => {
    const initLiff = async () => {
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID!;

      try {
        const liffModule = await import("@line/liff");
        const liff = liffModule.default;

        // Attempt LIFF init — may fail with "Unable to load client features"
        // if this page wasn't opened through liff.line.me URL scheme.
        let initFailed = false;
        try {
          await liff.init({ liffId });
        } catch (initErr) {
          const msg = initErr instanceof Error ? initErr.message : "";
          if (msg.includes("Unable to load client features")) {
            // We're in LINE's WebView but the LIFF native bridge wasn't set up.
            // This happens when the page was navigated to via a regular link
            // instead of through liff.line.me. We can still function — just
            // can't use native features like getProfile().
            console.warn("LIFF client features unavailable, using fallback mode:", msg);
            initFailed = true;
          } else {
            throw initErr; // Re-throw non-recoverable errors
          }
        }

        if (initFailed) {
          // Fallback: redirect through proper LIFF URL to establish bridge.
          // Use line://app/ scheme which opens a fresh LIFF WebView.
          const path = window.location.pathname;
          window.location.href = `https://liff.line.me/${liffId}${path}`;
          return;
        }

        const isLoggedIn = liff.isLoggedIn();
        const isInClient = liff.isInClient();

        if (!isLoggedIn) {
          liff.login({ redirectUri: window.location.href });
          return;
        }

        // Get profile — non-blocking: if it fails, still allow usage
        let userId: string | null = null;
        let displayName: string | null = null;
        let pictureUrl: string | null = null;

        try {
          const profile = await liff.getProfile();
          userId = profile.userId;
          displayName = profile.displayName;
          pictureUrl = profile.pictureUrl || null;
        } catch (profileErr) {
          console.warn("Failed to get LINE profile, continuing without it:", profileErr);
          try {
            const decodedToken = liff.getDecodedIDToken();
            userId = decodedToken?.sub || null;
            displayName = decodedToken?.name || null;
            pictureUrl = decodedToken?.picture || null;
          } catch {
            console.warn("Failed to get decoded token too");
          }
        }

        // Initialize session on backend and get stored user profile
        let realName: string | null = null;
        let phone: string | null = null;
        let birthday: string | null = null;

        if (userId) {
          try {
            const idToken = liff.getIDToken?.() || "";
            const initRes = await fetch("/api/liff/init", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(idToken ? { "X-LIFF-ID-Token": idToken } : {}),
              },
              // Body is now for optional profile hints only; server uses the verified
              // token's sub for lineUserId. Keeping displayName/pictureUrl as fallbacks
              // in case the token payload omits them (profile scope not granted).
              body: JSON.stringify({ displayName, pictureUrl }),
            });
            if (initRes.ok) {
              const initData = await initRes.json();
              realName = initData.user?.realName || null;
              phone = initData.user?.phone || null;
              birthday = initData.user?.birthday || null;
            }
          } catch (initErr) {
            console.warn("Failed to init backend session:", initErr);
          }
        }

        const idToken = liff.getIDToken?.() || null;

        setState({
          liff,
          isLoggedIn: true,
          isInClient,
          isReady: true,
          error: null,
          userId,
          displayName,
          pictureUrl,
          realName,
          phone,
          birthday,
          cachedIdToken: idToken,
        });

        // Persist for next page navigation in same session
        if (userId) {
          writeLiffCache({
            isLoggedIn: true,
            isInClient,
            userId,
            displayName,
            pictureUrl,
            realName,
            phone,
            birthday,
            cachedIdToken: idToken,
          });
        }
      } catch (err) {
        console.error("LIFF init error:", err);
        setState((prev) => ({
          ...prev,
          isReady: true,
          error: err instanceof Error ? err.message : "LIFF 初始化失敗",
        }));
      }
    };

    initLiff();
  }, []);

  return (
    <LiffContext.Provider value={state}>{children}</LiffContext.Provider>
  );
}
