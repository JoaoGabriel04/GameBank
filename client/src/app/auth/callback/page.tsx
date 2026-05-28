"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import api from "@/services/api";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();

  useEffect(() => {
    const token = searchParams.get("token");
    const error = searchParams.get("error");

    if (error || !token) {
      router.push("/login?error=" + (error || "auth_falhou"));
      return;
    }

    localStorage.setItem("jwt_token", token);

    api
      .get("/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        setAuth(token, res.data);
        router.push("/sessions");
      })
      .catch(() => {
        localStorage.removeItem("jwt_token");
        router.push("/login?error=token_invalido");
      });
  }, [searchParams, router, setAuth]);

  return (
    <p className="text-zinc-400">Autenticando...</p>
  );
}

export default function AuthCallback() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <Suspense fallback={<p className="text-zinc-400">Autenticando...</p>}>
        <CallbackContent />
      </Suspense>
    </div>
  );
}
