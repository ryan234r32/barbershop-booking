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

const TOKEN_KEY = "admin_token";

// Monkey-patch window.fetch to auto-include Authorization header for /api/* calls.
// Runs once on first import on the client side.
let fetchPatched = false;
function patchFetch() {
  if (fetchPatched || typeof window === "undefined") return;
  fetchPatched = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return originalFetch(input, init);

    // Only add header to same-origin /api/* requests
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const isApiRequest =
      url.startsWith("/api/") ||
      (typeof window !== "undefined" && url.startsWith(window.location.origin + "/api/"));

    if (!isApiRequest) return originalFetch(input, init);

    const headers = new Headers(init?.headers);
    if (!headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    return originalFetch(input, { ...init, headers });
  };
}

export function AdminProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Patch fetch immediately so initial /api/auth/me call uses the header
  if (typeof window !== "undefined") {
    patchFetch();
  }

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => {
        if (!r.ok) throw new Error("Not authenticated");
        return r.json();
      })
      .then((data) => setAdmin(data.admin))
      .catch(() => {
        // Clear stale token
        if (typeof window !== "undefined") {
          localStorage.removeItem(TOKEN_KEY);
        }
        router.replace("/login");
      })
      .finally(() => setLoading(false));
  }, [router]);

  const logout = async () => {
    await fetch("/api/auth/me", { method: "POST" });
    if (typeof window !== "undefined") {
      localStorage.removeItem(TOKEN_KEY);
    }
    setAdmin(null);
    router.replace("/login");
  };

  return (
    <AdminContext.Provider value={{ admin, loading, logout }}>
      {children}
    </AdminContext.Provider>
  );
}
