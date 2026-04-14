import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function Home() {
  // If admin is logged in, redirect to dashboard
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token");
  if (token) {
    redirect("/dashboard");
  }

  // Default: show a landing page that directs to booking (LIFF) or admin login
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[var(--color-brand)] tracking-wide">
            1008 Hair Studio
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            線上預約，輕鬆搞定
          </p>
        </div>

        {/* Business Info */}
        <div className="mb-8 space-y-2 text-sm text-foreground/70">
          <p>台北市中正區新生南路一段144-10號</p>
          <p>週二至週日 11:00-20:00（週一公休）</p>
          <p>02-2396-2306</p>
        </div>

        <div className="space-y-3">
          <a
            href="/booking"
            className="block w-full rounded-lg bg-[var(--color-brand)] px-6 py-3 text-center font-semibold text-[var(--color-bg)] transition hover:opacity-90"
          >
            立即預約
          </a>
          <a
            href="/my-bookings"
            className="block w-full rounded-lg border border-[var(--color-brand)] px-6 py-3 text-center font-medium text-[var(--color-brand)] transition hover:bg-secondary"
          >
            我的預約
          </a>
          <div className="pt-4">
            <a
              href="/login"
              className="inline-block border-b border-muted-foreground/40 pb-0.5 text-sm text-muted-foreground transition hover:border-foreground hover:text-foreground"
            >
              店家管理後台
            </a>
          </div>
        </div>
      </div>

      {/* Footer */}
      <p className="mt-12 text-xs text-muted-foreground">
        Powered by LINE 預約系統
      </p>
    </div>
  );
}
