'use client'

import { useRef, useState, useEffect } from 'react'

export default function MarqueeText({
  children,
  className = '',
}: {
  children: string
  className?: string
}) {
  const containerRef = useRef<HTMLSpanElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const [anim, setAnim] = useState<{ offset: number } | null>(null)

  useEffect(() => {
    const container = containerRef.current
    const text = textRef.current
    if (!container || !text) return

    let fontsReady = false

    const measure = () => {
      // Só medir depois das fontes estarem prontas
      // para evitar diff incorreto com fonte fallback
      if (!fontsReady) return

      const containerWidth = container.getBoundingClientRect().width
      const textWidth = text.getBoundingClientRect().width
      const diff = textWidth - containerWidth
      setAnim(diff > 2 ? { offset: diff } : null)
    }

    // Aguardar fontes ANTES de qualquer medição
    const ready = typeof document !== 'undefined' && 'fonts' in document
      ? document.fonts.ready
      : Promise.resolve()

    ready.then(() => {
      fontsReady = true
      measure()
    })

    // ResizeObserver só mede depois das fontes prontas
    const ro = new ResizeObserver(() => {
      if (fontsReady) measure()
    })
    ro.observe(container)
    ro.observe(text)
    return () => ro.disconnect()
  }, [children])

  useEffect(() => {
    const el = textRef.current
    if (!el || !anim) return
    const off = anim.offset + 8
    const ani = el.animate([
      { transform: 'translateX(0)', offset: 0 },
      { transform: 'translateX(0)', offset: 0.15 },
      { transform: `translateX(-${off}px)`, offset: 0.45 },
      { transform: `translateX(-${off}px)`, offset: 0.60 },
      { transform: 'translateX(0)', offset: 0.85 },
      { transform: 'translateX(0)', offset: 1 },
    ], {
      duration: 6000,
      iterations: Infinity,
    })
    return () => ani.cancel()
  }, [anim])

  return (
    <span
      ref={containerRef}
      className={`overflow-hidden whitespace-nowrap block ${className}`}
      style={anim ? {
        // Animando — fade só na direita (texto sai pela direita)
        // O fade da esquerda aparece só quando o texto já rolou
        maskImage: 'linear-gradient(to right, black 0%, black calc(100% - 12px), transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to right, black 0%, black calc(100% - 12px), transparent 100%)',
      } : undefined}
    >
      <span
        ref={textRef}
        className="inline-block"
      >
        {children}
      </span>
    </span>
  )
}
