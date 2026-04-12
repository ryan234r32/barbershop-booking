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
  });

  useEffect(() => {
    const initLiff = async () => {
      try {
        const liffModule = await import("@line/liff");
        const liff = liffModule.default;

        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! });

        const isLoggedIn = liff.isLoggedIn();
        const isInClient = liff.isInClient();

        if (!isLoggedIn) {
          // Preserve current path so user returns to /booking, not /
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
          // Try to get userId from decoded token as fallback
          try {
            const decodedToken = liff.getDecodedIDToken();
            userId = decodedToken?.sub || null;
            displayName = decodedToken?.name || null;
            pictureUrl = decodedToken?.picture || null;
          } catch {
            console.warn("Failed to get decoded token too");
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
        });

        // Initialize session on backend (only if we have userId)
        if (userId) {
          fetch("/api/liff/init", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lineUserId: userId, displayName, pictureUrl }),
          }).catch(console.error);
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
