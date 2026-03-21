import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        <div className="text-6xl font-bold text-gray-200">404</div>
        <h1 className="mt-4 text-xl font-semibold text-gray-900">
          找不到頁面
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          您要找的頁面不存在或已被移除
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="rounded-lg bg-green-500 px-6 py-2 text-sm font-medium text-white transition hover:bg-green-600"
          >
            回首頁
          </Link>
          <Link
            href="/booking"
            className="rounded-lg border border-gray-200 bg-white px-6 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            前往預約
          </Link>
        </div>
      </div>
    </div>
  );
}
