import { AdminClientShell } from "./client-shell";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminClientShell>{children}</AdminClientShell>;
}
