import { LiffClientProviders } from "./client-providers";

export default function LiffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LiffClientProviders>
      <div className="min-h-screen bg-[#FFF8F1]">{children}</div>
    </LiffClientProviders>
  );
}
