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
      <div className="lg:pt-16 pb-20 lg:pb-0 min-h-screen bg-zinc-950 relative">
        <div
          className="pointer-events-none fixed inset-0 z-0 opacity-[0.04]"
          style={{
            backgroundImage: "url(/images/hexa-background.png)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="relative z-10">
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
      </div>
    </>
  );
}
