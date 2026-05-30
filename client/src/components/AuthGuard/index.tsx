"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import Loading from "@/components/Loading";

interface AuthGuardProps {
  children: ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, loadFromStorage } = useAuthStore();

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      const redirect = encodeURIComponent(pathname);
      router.replace(`/login?redirect=${redirect}`);
      return;
    }
    if (!user.profileComplete) {
      router.replace("/onboarding");
    }
  }, [loading, user, router, pathname]);

  if (loading) {
    return <Loading label="Verificando autenticação..." />;
  }

  if (!user || !user.profileComplete) {
    return <Loading label="Redirecionando..." />;
  }

  return <>{children}</>;
}
