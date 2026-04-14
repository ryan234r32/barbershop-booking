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

// LIFF 路徑排除 — 不快取客人端頁面
const LIFF_PATHS = ["/booking", "/my-bookings", "/payment"];

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // 不處理 LIFF 路徑和 LINE 相關域名
  if (
    LIFF_PATHS.some((p) => url.pathname.startsWith(p)) ||
    url.hostname.includes("line.me") ||
    url.hostname.includes("line-scdn.net")
  ) {
    return; // 讓瀏覽器正常處理
  }
});

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
