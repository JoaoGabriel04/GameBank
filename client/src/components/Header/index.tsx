import { useState } from "react";
import { MobileMenu } from "../MobileMenu";
import { menuOptions } from "@/utils/menuOptions";
import Image from "next/image";
import Button1 from "../Button01";
import { useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import Link from "next/link";

export default function Header() {

  const router = useRouter();
  const [openMenu, setOpenMenu] = useState(false);

  return (
    <>
      <MobileMenu isOpen={openMenu} onClose={() => setOpenMenu(false)} menuOptions={menuOptions} />

      <header className="absolute w-full h-25 top-0 left-0 grid grid-cols-2 lg:grid-cols-3 justify-between items-center px-10 z-999">
        <div className="">
          <Image src={'/images/gamebank-logo.png'} alt="logo-gamebank" width={100} height={100} className="w-15" />
        </div>
        <nav className="hidden w-full lg:flex justify-center items-center">
          <ul className="w-full flex justify-center items-center gap-10">
            {menuOptions.map((option, index) => (
              <li key={index} className="font-jaro text-zinc-100 hover:scale-120 transition-all duration-100 cursor-pointer"><Link href={option.url}>{option.text}</Link></li>
            ))}
          </ul>
        </nav>
        <nav className="hidden lg:flex w-full justify-end items-center gap-4">
          <Button1
            size="lg"
            color="green"
            handle={() => router.push('/sessions')}
            className="z-20">
            Jogar
          </Button1>
        </nav>

        <button className="flex lg:hidden w-full justify-end items-center">
          <Menu size={25} onClick={() => setOpenMenu(true)} className="text-zinc-100 cursor-pointer" />
        </button>
      </header>
    </>
  )
}