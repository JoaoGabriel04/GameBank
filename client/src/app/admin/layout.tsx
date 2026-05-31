import AdminGuard from "@/components/AdminGuard";
import AdminNav from "@/components/AdminNav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <AdminNav />
      {/* lg:pl-56 = largura da sidebar desktop */}
      <div className="lg:pl-56 pb-20 lg:pb-0 min-h-screen bg-zinc-950">
        {children}
      </div>
    </AdminGuard>
  );
}
