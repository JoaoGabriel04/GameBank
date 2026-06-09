"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import Loading from "@/components/Loading";

interface AuthGuardProps {
  children: ReactNode;
}

function resolveApiBaseUrl() {
  if (
    process.env.NEXT_PUBLIC_API_URL &&
    process.env.NEXT_PUBLIC_API_URL.trim() !== ""
  ) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  return process.env.NODE_ENV === "development"
    ? "http://localhost:7000/api"
    : "https://gamebank-vtsb.onrender.com/api";
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, token, loading, loadFromStorage, logout } = useAuthStore();
  const [validating, setValidating] = useState(false);
  const validatedRef = useRef(false);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    if (loading) return;

    if (!user || !token) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    if (!user.profileComplete) {
      router.replace("/onboarding");
      return;
    }

    if (user.isAdmin && pathname.startsWith("/user")) {
      router.replace("/admin");
      return;
    }

    if (validatedRef.current) return;
    validatedRef.current = true;
    setValidating(true);

    fetch(`${resolveApiBaseUrl()}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) {
          logout();
          router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
        }
      })
      .catch(() => {
        // Network error — deixa o interceptor 401 tratar em chamadas reais
      })
      .finally(() => setValidating(false));
  }, [loading, user, token, router, pathname, logout]);

  if (loading || !user || !user.profileComplete || validating) {
    return <Loading label="Verificando autenticação..." />;
  }

  return <>{children}</>;
}
