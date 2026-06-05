"use client";

import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { fadeIn } from "@/lib/animations";
import UserNav from "@/components/UserNav";

export default function UserMainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <>
      <UserNav />
      {/* pt-16 = altura do header desktop; pb-20 = altura do bottom nav mobile */}
      <div className="lg:pt-16 pb-20 lg:pb-0 min-h-screen bg-zinc-950">
        <AnimatePresence mode="wait">
          <motion.div key={pathname} variants={fadeIn} initial="hidden" animate="visible" exit="exit">
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}
