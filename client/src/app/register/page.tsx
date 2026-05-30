"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import api from "@/services/api";
import Link from "next/link";
import { getPostAuthPath } from "@/utils/authRedirect";

export default function RegisterPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [error, setError] = useState("");

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:7000/api";

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const res = await api.post("/auth/register", { email, senha });
      setAuth(res.data.token, res.data.user);
      router.push(getPostAuthPath(res.data.user));
    } catch (err: any) {
      setError(err.response?.data?.error || "Erro ao cadastrar");
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="text-4xl font-jaro text-center text-green-400 mb-8">GameBank</h1>

        <div className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800">
          <h2 className="text-xl font-jaro text-zinc-100 mb-2 text-center">Criar Conta</h2>
          <p className="text-zinc-500 text-sm text-center font-inconsolata mb-6">
            Depois você escolhe apelido e avatar — como no Xbox.
          </p>

          {error && (
            <p className="text-red-400 text-sm text-center mb-4 bg-red-500/10 rounded-lg p-2">
              {error}
            </p>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-zinc-800 text-zinc-100 rounded-xl px-4 py-3 border border-zinc-700 focus:outline-none focus:border-green-500 font-inconsolata"
              required
            />
            <input
              type="password"
              placeholder="Senha (mín. 6 caracteres)"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full bg-zinc-800 text-zinc-100 rounded-xl px-4 py-3 border border-zinc-700 focus:outline-none focus:border-green-500 font-inconsolata"
              required
              minLength={6}
            />
            <button
              type="submit"
              className="w-full bg-green-600 hover:bg-green-500 text-white font-jaro py-3 rounded-xl transition-colors cursor-pointer"
            >
              Continuar
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-700" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-zinc-900 text-zinc-500 font-jaro">ou</span>
            </div>
          </div>

          <div className="space-y-3">
            <a
              href={`${baseUrl}/auth/google`}
              className="w-full flex items-center justify-center gap-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-jaro py-3 px-4 rounded-xl transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Entrar com Google
            </a>

            <a
              href={`${baseUrl}/auth/discord`}
              className="w-full flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-500 text-white font-jaro py-3 px-4 rounded-xl transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.947 2.418-2.157 2.418z"/></svg>
              Entrar com Discord
            </a>
          </div>

          <p className="text-center text-zinc-500 text-sm mt-6 font-inconsolata">
            Já tem conta?{" "}
            <Link href="/login" className="text-green-400 hover:underline">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
