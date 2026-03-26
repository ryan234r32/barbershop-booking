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
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-green-50 to-white px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mb-8">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-500 text-3xl text-white shadow-lg">
            ✂️
          </div>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">
            1008 Hair Studio
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            線上預約，輕鬆搞定
          </p>
        </div>

        {/* Business Info */}
        <div className="mb-8 space-y-2 text-sm text-gray-600">
          <p>📍 台北市中正區新生南路一段144-10號</p>
          <p>🕐 週二至週日 11:00-20:00（週一公休）</p>
          <p>📞 02-2396-2306</p>
        </div>

        <div className="space-y-3">
          <a
            href="/booking"
            className="block w-full rounded-xl bg-emerald-500 px-6 py-3 text-center font-medium text-white shadow-sm transition hover:bg-emerald-600"
          >
            立即預約
          </a>
          <a
            href="/my-bookings"
            className="block w-full rounded-xl border border-gray-200 bg-white px-6 py-3 text-center font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
          >
            我的預約
          </a>
          <div className="pt-4">
            <a
              href="/login"
              className="text-sm text-gray-400 transition hover:text-gray-600"
            >
              店家管理後台
            </a>
          </div>
        </div>
      </div>

      {/* Footer */}
      <p className="mt-12 text-xs text-gray-300">
        Powered by LINE 預約系統
      </p>
    </div>
  );
}
