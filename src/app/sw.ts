/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck -- service-worker globals don't play well with strict TS
/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope & WorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

// Note: defaultCache (Serwist) already handles LIFF pages safely:
//   • _next/static/*  → CacheFirst (content-hashed, never stale)
//   • HTML documents  → NetworkFirst (LIFF pages always fetch fresh, fall back
//                        to cache offline)
//   • _next/data RSC  → StaleWhileRevalidate (snappy nav, refreshes in bg)
// The previous LIFF_PATHS exclusion listener was a no-op (no event.respondWith)
// and has been removed. line.me / line-scdn.net are cross-origin and Serwist
// won't try to cache them anyway.

// Web Push 推播接收
self.addEventListener("push", (event) => {
  if (!event.data) return;

  const data = event.data.json() as {
    title: string;
    body: string;
    url?: string;
    tag?: string;
  };

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag || "default",
      data: { url: data.url || "/calendar" },
    })
  );
});

// 點擊通知 → 打開 PWA 跳到對應頁面
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = (event.notification.data?.url as string) || "/calendar";

  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      // 如果已有視窗，focus 並導航
      for (const client of clients) {
        if ("focus" in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      // 否則開新視窗
      return self.clients.openWindow(url);
    })
  );
});

serwist.addEventListeners();
