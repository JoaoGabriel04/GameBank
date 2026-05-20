'use client'

import { useEffect, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { X } from 'lucide-react'
import Link from 'next/link'
import gsap from 'gsap'
import Button1 from '../Button01'
import { useRouter } from 'next/navigation'

interface MobileMenuProps {
  isOpen: boolean
  onClose: () => void
  menuOptions: { text: string; url: string }[]
}

export function MobileMenu({ isOpen, onClose, menuOptions }: MobileMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const router = useRouter();

  useEffect(() => {
    if (isOpen) {
      gsap.set([backdropRef.current, menuRef.current], { opacity: 0 })
      gsap.set(menuRef.current, { scale: 0.9 })

      gsap.to(backdropRef.current, {
        opacity: 1,
        duration: 0.3,
        ease: 'power2.out'
      })

      gsap.to(menuRef.current, {
        opacity: 1,
        scale: 1,
        duration: 0.3,
        ease: 'power2.out'
      })
    } else {
      const tl = gsap.timeline({
        onComplete: () => {
          gsap.set([backdropRef.current, menuRef.current], { opacity: 0 })
          gsap.set(menuRef.current, { scale: 0.9 })
        }
      })

      tl.to(menuRef.current, {
        opacity: 0,
        scale: 0.9,
        duration: 0.25,
        ease: 'power2.in'
      })
        .to(backdropRef.current, {
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


          <Button1
            size="lg"
            color="green"
            handle={() => router.push('/sessions')}
            className="z-20">
            Jogar
          </Button1>
        </Card>
      </div>
    </div>
  )
}