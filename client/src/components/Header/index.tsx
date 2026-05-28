import { useState, useEffect } from "react";
import { MobileMenu } from "../MobileMenu";
import { menuOptions } from "@/utils/menuOptions";
import Image from "next/image";
import Button1 from "../Button01";
import { useRouter } from "next/navigation";
import { Menu, LogOut, User } from "lucide-react";
import Link from "next/link";
import { useAuthStore } from "@/stores/authStore";

type HeaderProps = {
  aba?: string;
}

export default function Header({ aba }: HeaderProps) {

  const router = useRouter();
  const [openMenu, setOpenMenu] = useState(false);
  const { user, logout, loadFromStorage } = useAuthStore();

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  function handleNavigate(path: string) {
    if (user) {
      router.push(path);
    } else {
      router.push(`/login?redirect=${encodeURIComponent(path)}`);
    }
  }

  return (
    <>
      <MobileMenu isOpen={openMenu} onClose={() => setOpenMenu(false)} menuOptions={menuOptions} aba={aba}/>

      <header className="absolute w-full h-25 top-0 left-0 grid grid-cols-2 lg:grid-cols-3 justify-between items-center px-10 z-999">
        <div className="">
          <Link href={'/'}>
            <Image src={'/images/gamebank-logo.png'} alt="logo-gamebank" width={100} height={100} className="w-15" />
          </Link>
        </div>
        <nav className="hidden w-full lg:flex justify-center items-center">
          <ul className="w-full flex justify-center items-center gap-10">
            {menuOptions.map((option, index) => (
              <li key={index} className="font-jaro text-zinc-100 hover:scale-120 transition-all duration-100 cursor-pointer"><Link href={option.url}>{option.text}</Link></li>
            ))}
          </ul>
        </nav>
        <nav className="hidden lg:flex w-full justify-end items-center gap-4">
          {user ? (
            <div className="flex items-center gap-4">
              <span className="text-zinc-300 font-jaro text-sm truncate max-w-32">{user.nome}</span>
              {aba === "Sessions" ? (
                <Button1 size="lg" color="green" handle={() => handleNavigate('/new-session')} className="z-20">
                  Criar Sessão
                </Button1>
              ) : (
                <Button1 size="lg" color="green" handle={() => handleNavigate('/sessions')} className="z-20">
                  Jogar
                </Button1>
              )}
              <button onClick={() => { logout(); router.push('/'); }} className="text-zinc-400 hover:text-red-400 transition-colors" title="Sair">
                <LogOut size={20} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button onClick={() => router.push('/login')} className="text-zinc-300 hover:text-green-400 font-jaro transition-colors">
                Entrar
              </button>
              <Button1 size="md" color="green" handle={() => router.push('/register')}>
                Cadastrar
              </Button1>
            </div>
          )}
        </nav>

        <button className="flex lg:hidden w-full justify-end items-center">
          <Menu size={25} onClick={() => setOpenMenu(true)} className="text-zinc-100 cursor-pointer" />
        </button>
      </header>
    </>
  )
}