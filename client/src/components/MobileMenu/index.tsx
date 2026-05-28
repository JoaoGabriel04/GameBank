'use client'

import { useEffect, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { X, LogOut, User } from 'lucide-react'
import Link from 'next/link'
import gsap from 'gsap'
import Button1 from '../Button01'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'

interface MobileMenuProps {
  aba?: string;
  isOpen: boolean
  onClose: () => void
  menuOptions: { text: string; url: string }[]
}

export function MobileMenu({ aba, isOpen, onClose, menuOptions }: MobileMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const router = useRouter();
  const { user, logout } = useAuthStore();

  useEffect(() => {
    const menu = menuRef.current
    const backdrop = backdropRef.current
    if (!menu || !backdrop) return

    if (isOpen) {
      gsap.set([backdrop, menu], { opacity: 0 })
      gsap.set(menu, { scale: 0.9 })

      gsap.to(backdrop, {
        opacity: 1,
        duration: 0.3,
        ease: 'power2.out'
      })

      gsap.to(menu, {
        opacity: 1,
        scale: 1,
        duration: 0.3,
        ease: 'power2.out'
      })
    } else {
      const tl = gsap.timeline({
        onComplete: () => {
          gsap.set([backdrop, menu], { opacity: 0 })
          gsap.set(menu, { scale: 0.9 })
        }
      })

      tl.to(menu, {
        opacity: 0,
        scale: 0.9,
        duration: 0.25,
        ease: 'power2.in'
      })
        .to(backdrop, {
          opacity: 0,
          duration: 0.25,
          ease: 'power2.in'
        }, 0)
    }
  }, [isOpen])

  function handleNavigate() {
    onClose()
  }

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-50 ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
    >
      <div
        ref={backdropRef}
        className="absolute inset-0 bg-zinc-900/80 backdrop-blur-[3px] cursor-pointer opacity-0"
        onClick={onClose}
      />

      <div className="relative w-full h-full flex justify-center items-center px-4">
        <Card
          ref={menuRef}
          className="w-full px-3 flex flex-col items-center gap-4 opacity-0"
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
          >
            <X size={24} />
          </button>

          <div className="mt-8 flex flex-col items-center gap-4">
            {menuOptions.map((option, index) => (
              <Link
                key={index}
                href={option.url}
                onClick={handleNavigate}
                className="text-zinc-800 dark:text-zinc-100 hover:text-blue-500 hover:font-semibold transition-all"
              >
                {option.text}
              </Link>
            ))}
          </div>

          {user ? (
            <div className="w-full flex flex-col items-center gap-3 px-4 mt-2">
              <span className="text-zinc-300 font-jaro text-sm truncate max-w-40 flex items-center gap-2">
                <User size={16} /> {user.nome}
              </span>
              <Button1
                size="lg"
                color="green"
                handle={() => router.push(aba === "Sessions" ? '/new-session' : '/sessions')}
                className="z-20 w-full"
              >
                {aba === "Sessions" ? "Criar Sessão" : "Jogar"}
              </Button1>
              <button
                onClick={() => { logout(); router.push('/'); onClose(); }}
                className="flex items-center gap-2 text-zinc-400 hover:text-red-400 transition-colors font-inconsolata text-sm"
              >
                <LogOut size={16} /> Sair
              </button>
            </div>
          ) : (
            <div className="w-full flex flex-col items-center gap-3 px-4 mt-2">
              <Link
                href="/login"
                onClick={handleNavigate}
                className="w-full text-center py-2 text-zinc-300 hover:text-green-400 font-jaro transition-colors border border-zinc-700 rounded-lg"
              >
                Entrar
              </Link>
              <Button1
                size="lg"
                color="green"
                handle={() => router.push('/register')}
                className="z-20 w-full"
              >
                Cadastrar
              </Button1>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}