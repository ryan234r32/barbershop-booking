"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
  tenant: { businessName: string; phone: string | null };
}

interface AdminContextType {
  admin: AdminUser | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AdminContext = createContext<AdminContextType>({
  admin: null,
  loading: true,
  logout: async () => {},
});

export function useAdmin() {
  return useContext(AdminContext);
}

export function AdminProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => {
        if (!r.ok) throw new Error("Not authenticated");
        return r.json();
      })
      .then((data) => setAdmin(data.admin))
      .catch(() => {
        router.replace("/login");
      })
      .finally(() => setLoading(false));
  }, [router]);

  const logout = async () => {
    await fetch("/api/auth/me", { method: "POST" });
    setAdmin(null);
    router.replace("/login");
  };

  return (
    <AdminContext.Provider value={{ admin, loading, logout }}>
      {children}
    </AdminContext.Provider>
  );
}
