import AdminGuard from "@/components/AdminGuard";
import { AdminProvider } from "@/contexts/AdminContext";
import AdminLayout from "@/components/admin/AdminLayout";
import "@/styles/admin-tokens.css";

export default function RootAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <AdminProvider>
        <AdminLayout>{children}</AdminLayout>
      </AdminProvider>
    </AdminGuard>
  );
}
