'use client'

import { useEffect, useState, createContext, useContext, useCallback } from "react"
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react"
import { registerToastFns } from "@/lib/toast"

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: number
  type: ToastType
  message: string
}

interface ToastContextType {
  success: (message: string) => void
  error: (message: string) => void
  warning: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider")
  }
  return context
}

const typeStyles: Record<ToastType, { icon: React.ReactNode; borderColor: string; iconColor: string }> = {
  success: {
    icon: <CheckCircle className="w-5 h-5" />,
    borderColor: 'border-l-green-500',
    iconColor: 'text-green-400',
  },
  error: {
    icon: <AlertCircle className="w-5 h-5" />,
    borderColor: 'border-l-red-500',
    iconColor: 'text-red-400',
  },
  warning: {
    icon: <AlertTriangle className="w-5 h-5" />,
    borderColor: 'border-l-amber-500',
    iconColor: 'text-amber-400',
  },
  info: {
    icon: <Info className="w-5 h-5" />,
    borderColor: 'border-l-blue-500',
    iconColor: 'text-blue-400',
  },
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, type, message }])

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }, [])

  const success = useCallback((message: string) => addToast('success', message), [addToast])
  const error = useCallback((message: string) => addToast('error', message), [addToast])
  const warning = useCallback((message: string) => addToast('warning', message), [addToast])
  const info = useCallback((message: string) => addToast('info', message), [addToast])

  useEffect(() => {
    registerToastFns({ success, error, warning, info })
  }, [success, error, warning, info])

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  return (
    <ToastContext.Provider value={{ success, error, warning, info }}>
      {children}
      {mounted && (
        <div className="fixed top-4 right-4 z-[100000] flex flex-col gap-2 max-w-sm">
          {toasts.map((toast) => {
            const style = typeStyles[toast.type]
            return (
              <div
                key={toast.id}
                className={`
                  flex items-start gap-3 p-4 rounded-lg border border-zinc-700/80 border-l-4
                  ${style.borderColor} bg-zinc-900/95 backdrop-blur-sm
                  animate-slide-in shadow-lg
                `}
              >
                <span className={`mt-0.5 ${style.iconColor}`}>{style.icon}</span>
                <p className="flex-1 text-sm font-inconsolata text-zinc-200 leading-relaxed">
                  {toast.message}
                </p>
                <button
                  onClick={() => removeToast(toast.id)}
                  className="text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </ToastContext.Provider>
  )
}