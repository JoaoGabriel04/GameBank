import AdminGuard from "@/components/AdminGuard";
import AdminNav from "@/components/AdminNav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <AdminNav />
      {/* pt-14 = header mobile; pb-20 = bottom nav mobile; lg:pl-56 = sidebar desktop */}
      <div className="pt-22 lg:pt-0 lg:pl-56 pb-20 lg:pb-0 px-4 min-h-screen bg-zinc-950">
        {children}
      </div>
    </AdminGuard>
  );
}
