"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import Loading from "@/components/Loading";

export default function AdminGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, loading, loadFromStorage } = useAuthStore();

  useEffect(() => { loadFromStorage(); }, [loadFromStorage]);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }
    if (!user.isAdmin) { router.replace("/user"); }
  }, [loading, user, router]);

  if (loading || !user || !user.isAdmin) {
    return <Loading label="Verificando permissões..." />;
  }

  return <>{children}</>;
}
