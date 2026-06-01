import UserNav from "@/components/UserNav";

export default function UserMainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <UserNav />
      {/* pt-16 = altura do header desktop; pb-20 = altura do bottom nav mobile */}
      <div className="lg:pt-16 pb-20 lg:pb-0 min-h-screen bg-zinc-950">
        {children}
      </div>
    </>
  );
}
