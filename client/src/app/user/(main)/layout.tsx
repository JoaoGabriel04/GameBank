"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { fadeIn } from "@/lib/animations";
import UserNav from "@/components/UserNav";
import { useAuthStore } from "@/stores/authStore";
import { useProfileStore } from "@/stores/profileStore";

export default function UserMainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const token = useAuthStore((s) => s.token);
  const loadProfile = useProfileStore((s) => s.loadProfile);

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => loadProfile(), 30000);
    return () => clearInterval(interval);
  }, [token, loadProfile]);

  return (
    <>
      <UserNav />
      {/* pt-16 = altura do header desktop; pb-20 = altura do bottom nav mobile */}
      <div className="lg:pt-16 pb-20 lg:pb-0 min-h-screen bg-zinc-950">
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            variants={fadeIn}
            initial={false}
            animate="visible"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}
