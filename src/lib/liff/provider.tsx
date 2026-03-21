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
          liff.login();
          return;
        }

        // Get profile
        const profile = await liff.getProfile();

        setState({
          liff,
          isLoggedIn: true,
          isInClient,
          isReady: true,
          error: null,
          userId: profile.userId,
          displayName: profile.displayName,
          pictureUrl: profile.pictureUrl || null,
        });

        // Initialize session on backend
        fetch("/api/liff/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lineUserId: profile.userId,
            displayName: profile.displayName,
            pictureUrl: profile.pictureUrl,
          }),
        }).catch(console.error);
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
