"use client";

import { useState, useEffect } from "react";
import AdminNav from "./AdminNav";
import AdminTopbar from "./AdminTopbar";
import { usePathname } from "next/navigation";
import { useAdminStore } from "@/stores/adminStore";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const TITLES: Record<string, [string, string]> = {
  "/admin": ["Dashboard", "Visão geral da operação em tempo real"],
  "/admin/audit": ["Auditoria", "Registro de ações administrativas e do sistema"],
  "/admin/sessions": ["Sessões ao vivo", "Monitore e controle partidas em andamento"],
  "/admin/users": ["Usuários", "Gerencie contas, níveis, itens e permissões"],
  "/admin/shop": ["Loja", "Crie e gerencie itens cosméticos"],
  "/admin/missions": ["Missões & Recompensas", "Configure objetivos e suas recompensas"],
  "/admin/cards": ["Cartas", "Edite o baralho de Sorte e Revés"],
  "/admin/cosmetics": ["Cosméticos", "Banners personalizados e biblioteca de sprites"],
  "/admin/economy": ["Economia global", "Saldos, multiplicadores e flags do sistema"],
};

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const [title, sub] = TITLES[pathname] || ["Admin", ""];
  const { loadDashboard } = useAdminStore();

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(loadDashboard, 30000);
    return () => clearInterval(interval);
  }, [loadDashboard]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        // Command palette would open here
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950">
      <AdminNav open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="lg:ml-[240px] flex flex-col min-h-screen">
        <AdminTopbar
          title={title}
          subtitle={sub}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6 max-w-[1400px] w-full mx-auto">
          <div>{children}</div>
        </main>
      </div>
    </div>
  );
}
