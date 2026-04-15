"use client";

/**
 * ATM (Tier S) tab for /admin/payments.
 *
 * Self-contained: loads ECPay orders + monthly summary + amount-mismatch alerts
 * via SWR with 30s refresh (auto-reconciliation doesn't need instant latency).
 *
 * Sections:
 *   A. 待入帳 (PENDING)   — virtual account issued, waiting for deposit
 *   B. 已入帳 (PAID)       — webhook-confirmed, last 7 days
 *   C. 異常 (FAILED + EXPIRED + amount-mismatch alerts) — needs attention
 *
 * No manual mark-received action here — admin uses the 末五碼 tab for overrides.
 */

import useSWR from "swr";
import { useEffect, useMemo } from "react";
import { adminHeaders } from "@/lib/auth/admin-fetch";

const fetcher = (url: string) =>
  fetch(url, { headers: adminHeaders() }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ECPayOrderStatus =
  | "CREATED"
  | "PENDING"
  | "PAID"
  | "EXPIRED"
  | "FAILED";

export interface ECPayOrderDTO {
  id: string;
  merchantTradeNo: string;
  tradeNo: string | null;
  amount: number;
  bankCode: string | null;
  vAccount: string | null;
  expireDate: string | null;
  status: ECPayOrderStatus;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
  booking: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    status: string;
    service: { name: string; price: number; slotsNeeded: number };
    user: {
      id: string;
      displayName: string;
      phone: string | null;
      lineUserId: string | null;
    };
  };
  payment: {
    id: string;
    status: string;
    method: string | null;
    receivedAt: string | null;
  } | null;
}

interface OrdersResponse {
  items: ECPayOrderDTO[];
  nextCursor: string | null;
}

interface MonthlySummary {
  count: number;
  total: number;
  cap: number;
  percentage: number;
}

/* ------------------------------------------------------------------ */
/*  Derived-state helper (exported for test)                           */
/* ------------------------------------------------------------------ */

export function partitionOrders(orders: ECPayOrderDTO[]) {
  const sevenDaysAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const pending: ECPayOrderDTO[] = [];
  const paid: ECPayOrderDTO[] = [];
  const trouble: ECPayOrderDTO[] = [];
  for (const o of orders) {
    if (o.status === "PENDING" || o.status === "CREATED") {
      pending.push(o);
    } else if (o.status === "PAID") {
      const updatedMs = new Date(o.updatedAt).getTime();
      if (updatedMs >= sevenDaysAgoMs) paid.push(o);
    } else if (o.status === "EXPIRED" || o.status === "FAILED") {
      trouble.push(o);
    }
  }
  return { pending, paid, trouble };
}

export function summaryTone(percentage: number): "ok" | "warn" | "crit" {
  if (percentage >= 100) return "crit";
  if (percentage >= 90) return "warn";
  return "ok";
}

function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "剛剛";
  if (min < 60) return `${min} 分鐘前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小時前`;
  return `${Math.floor(hr / 24)} 天前`;
}

function formatDateShort(iso: string): string {
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  return `${Number(parts[1])}/${Number(parts[2])}`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface Props {
  onOpenBooking?: (bookingId: string) => void;
  onAttentionCount?: (count: number) => void;
}

export function EcpayAtmTab({ onOpenBooking, onAttentionCount }: Props) {
  const { data: ordersData, isLoading } = useSWR<OrdersResponse>(
    "/api/admin/ecpay/orders?status=all",
    fetcher,
    { refreshInterval: 30_000 }
  );
  const { data: summary } = useSWR<MonthlySummary>(
    "/api/admin/ecpay/monthly-summary",
    fetcher,
    { refreshInterval: 60_000 }
  );

  const { pending, paid, trouble } = useMemo(
    () => partitionOrders(ordersData?.items ?? []),
    [ordersData]
  );

  // Notify parent of attention-worthy count for tab badge
  const attentionCount = trouble.length;
  useEffect(() => {
    onAttentionCount?.(attentionCount);
  }, [attentionCount, onAttentionCount]);

  const tone = summaryTone(summary?.percentage ?? 0);

  return (
    <div className="space-y-4">
      {/* Monthly summary card */}
      <div
        className={`rounded-xl border p-4 ${
          tone === "crit"
            ? "bg-red-50 border-red-300 dark:bg-red-950/30 dark:border-red-800"
            : tone === "warn"
              ? "bg-amber-50 border-amber-300 dark:bg-amber-950/30 dark:border-amber-800"
              : "bg-card border-border"
        }`}
      >
        <p className="text-xs text-muted-foreground">本月自動對帳</p>
        {summary ? (
          <>
            <p className="text-lg font-semibold mt-1">
              {summary.count} 筆 · NT${summary.total.toLocaleString()}
            </p>
            <div className="mt-2 text-xs text-muted-foreground">
              本月額度：NT${summary.total.toLocaleString()} / NT$
              {summary.cap.toLocaleString()}
            </div>
            <div className="mt-1.5 h-2 w-full rounded-full bg-secondary overflow-hidden">
              <div
                className={`h-full transition-all ${
                  tone === "crit"
                    ? "bg-red-500"
                    : tone === "warn"
                      ? "bg-amber-500"
                      : "bg-[var(--color-brand)]"
                }`}
                style={{
                  width: `${Math.min(100, summary.percentage)}%`,
                }}
              />
            </div>
            {tone === "warn" && (
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
                ⚠️ 已超過本月額度 90%，接近 NT$
                {summary.cap.toLocaleString()} 上限
              </p>
            )}
            {tone === "crit" && (
              <p className="text-xs text-red-700 dark:text-red-300 mt-2">
                🚨 已達本月額度上限，新訂單將自動引導至末五碼轉帳
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground mt-1">載入中…</p>
        )}
      </div>

      {isLoading && !ordersData ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Section A: 待入帳 */}
          <Section title="待入帳" count={pending.length}>
            {pending.length === 0 ? (
              <EmptyMsg text="沒有等待入帳的訂單" />
            ) : (
              pending.map((o) => (
                <OrderRow
                  key={o.id}
                  order={o}
                  variant="pending"
                  onClick={() => onOpenBooking?.(o.booking.id)}
                />
              ))
            )}
          </Section>

          {/* Section B: 已入帳 */}
          <Section title="已入帳（近 7 天）" count={paid.length}>
            {paid.length === 0 ? (
              <EmptyMsg text="近 7 天沒有自動入帳紀錄" />
            ) : (
              paid.map((o) => (
                <OrderRow
                  key={o.id}
                  order={o}
                  variant="paid"
                  onClick={() => onOpenBooking?.(o.booking.id)}
                />
              ))
            )}
          </Section>

          {/* Section C: 異常 */}
          <Section title="異常" count={trouble.length} tone="warn">
            {trouble.length === 0 ? (
              <EmptyMsg text="沒有異常訂單" />
            ) : (
              trouble.map((o) => (
                <OrderRow
                  key={o.id}
                  order={o}
                  variant="trouble"
                  onClick={() => onOpenBooking?.(o.booking.id)}
                />
              ))
            )}
          </Section>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Subcomponents                                                      */
/* ------------------------------------------------------------------ */

function Section({
  title,
  count,
  tone,
  children,
}: {
  title: string;
  count: number;
  tone?: "warn";
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2 px-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            tone === "warn" && count > 0
              ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
              : "bg-secondary text-muted-foreground"
          }`}
        >
          {count}
        </span>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function EmptyMsg({ text }: { text: string }) {
  return (
    <div className="bg-card rounded-xl border border-border py-6 text-center text-muted-foreground text-sm">
      {text}
    </div>
  );
}

function OrderRow({
  order,
  variant,
  onClick,
}: {
  order: ECPayOrderDTO;
  variant: "pending" | "paid" | "trouble";
  onClick: () => void;
}) {
  const { booking } = order;
  const isClickable = variant === "paid" || variant === "trouble";

  const borderClass =
    variant === "trouble"
      ? "border-amber-300 dark:border-amber-800"
      : "border-border";

  return (
    <div
      className={`bg-card rounded-xl border p-4 ${borderClass} ${
        isClickable ? "cursor-pointer hover:bg-background transition-colors" : ""
      }`}
      onClick={isClickable ? onClick : undefined}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground truncate">
            {variant === "paid" && (
              <span className="text-[var(--color-brand)] mr-1">✓</span>
            )}
            {variant === "trouble" && <span className="mr-1">⚠️</span>}
            {booking.user.displayName}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatDateShort(booking.date)} · {booking.startTime} ·{" "}
            {booking.service.name}
          </p>
        </div>
        <span className="shrink-0 font-semibold text-foreground text-sm">
          NT${order.amount.toLocaleString()}
        </span>
      </div>

      {variant === "pending" && (
        <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
          {order.vAccount && (
            <div className="font-mono">
              ({order.bankCode}) {order.vAccount}
            </div>
          )}
          {order.expireDate && (
            <div>
              到期：{new Date(order.expireDate).toLocaleString("zh-TW")}
            </div>
          )}
          <div>已產生帳號 {relativeTime(order.createdAt)}</div>
        </div>
      )}

      {variant === "paid" && (
        <div className="mt-2 text-xs text-muted-foreground">
          自動對帳 {relativeTime(order.payment?.receivedAt ?? order.updatedAt)}
        </div>
      )}

      {variant === "trouble" && (
        <div className="mt-2 text-xs text-amber-800 dark:text-amber-300 space-y-0.5">
          {order.status === "EXPIRED" && (
            <div>虛擬帳號已過期，請客人改用現金或重新建立訂單</div>
          )}
          {order.status === "FAILED" && (
            <div>建單失敗：{order.failureReason ?? "未知原因"}</div>
          )}
          <div className="text-muted-foreground">
            {relativeTime(order.updatedAt)} · 點擊查看訂單
          </div>
        </div>
      )}
    </div>
  );
}
