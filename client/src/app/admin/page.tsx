"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "@/components/Toast";

export default function AdminPage() {
  const router = useRouter();
  const { user, loadFromStorage } = useAuthStore();
  const { error: toastError } = useToast();

  useEffect(() => { loadFromStorage(); }, [loadFromStorage]);

  useEffect(() => {
    if (user === null) return; // ainda carregando
    if (!user.isAdmin) {
      toastError("Acesso restrito a administradores.");
      router.replace("/");
    } else {
      router.replace("/admin/loja");
    }
  }, [user, router, toastError]);

  return null;
}
