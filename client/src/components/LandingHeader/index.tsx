"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";

export default function LandingHeader() {
  const router = useRouter();
  const { user, loadFromStorage } = useAuthStore();

  useEffect(() => { loadFromStorage(); }, [loadFromStorage]);

  function handleCTA() {
    if (!user) {
      router.push("/login");
      return;
    }
    router.push(user.isAdmin ? "/admin" : "/user");
  }

  return (
    <header className="absolute top-0 left-0 w-full flex items-center justify-between px-6 sm:px-10 h-20 z-50">
      <Link href="/">
        <Image
          src="/images/gamebank-logo.png"
          alt="GameBank"
          width={100}
          height={100}
          className="w-14"
        />
      </Link>

      <button
        onClick={handleCTA}
        className="font-jaro text-sm px-5 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white transition-colors cursor-pointer"
      >
        {user ? "Acessar" : "Entrar"}
      </button>
    </header>
  );
}
