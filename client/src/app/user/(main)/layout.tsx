"use client";

import UserNav from "@/components/UserNav";
import { ConteudoDaPagina, TransicaoPaginaProvider } from "@/components/TransicaoPagina";

export default function UserMainLayout({ children }: { children: React.ReactNode }) {
  return (
    <TransicaoPaginaProvider>
      <UserNav />
      {/* pt-16 = altura do header desktop; pb-20 = altura do bottom nav mobile */}
      <div className="lg:pt-16 pb-20 lg:pb-0 min-h-screen bg-zinc-950 relative">
        <div
          className="pointer-events-none fixed inset-0 z-0 opacity-[0.04]"
          style={{
            backgroundImage: "url(/images/hexa-background.webp)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="relative z-10">
          <ConteudoDaPagina>{children}</ConteudoDaPagina>
        </div>
      </div>
    </TransicaoPaginaProvider>
  );
}
