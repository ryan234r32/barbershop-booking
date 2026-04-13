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
}

const LiffContext = createContext<LiffContextType>({
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
});

export function useLiff() {
  return useContext(LiffContext);
}

export function LiffProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LiffContextType>({
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
            const initRes = await fetch("/api/liff/init", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ lineUserId: userId, displayName, pictureUrl }),
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
        });
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
