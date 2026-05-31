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

  useEffect(() => { loadFromStorage(); }, [loadFromStorage]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    if (!user.profileComplete) {
      router.replace("/onboarding");
      return;
    }
    // Admin tentando acessar área de usuário → redireciona para admin
    if (user.isAdmin && pathname.startsWith("/user")) {
      router.replace("/admin");
    }
  }, [loading, user, router, pathname]);

  if (loading || !user || !user.profileComplete) {
    return <Loading label="Verificando autenticação..." />;
  }

  return <>{children}</>;
}
