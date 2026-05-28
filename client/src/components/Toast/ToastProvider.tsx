'use client'

import { useEffect, useState, createContext, useContext, useCallback } from "react"
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react"

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

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  const getToastConfig = (type: ToastType) => {
    switch (type) {
      case 'success':
        return {
          icon: <CheckCircle className="w-5 h-5" />,
          bg: 'bg-green-500/20',
          border: 'border-green-500',
          text: 'text-green-400',
          title: 'Sucesso'
        }
      case 'error':
        return {
          icon: <AlertCircle className="w-5 h-5" />,
          bg: 'bg-red-500/20',
          border: 'border-red-500',
          text: 'text-red-400',
          title: 'Erro'
        }
      case 'warning':
        return {
          icon: <AlertTriangle className="w-5 h-5" />,
          bg: 'bg-amber-500/20',
          border: 'border-amber-500',
          text: 'text-amber-400',
          title: 'Atenção'
        }
      case 'info':
        return {
          icon: <Info className="w-5 h-5" />,
          bg: 'bg-blue-500/20',
          border: 'border-blue-500',
          text: 'text-blue-400',
          title: 'Info'
        }
    }
  }

return (
    <ToastContext.Provider value={{ success, error, warning, info }}>
      {children}
      {mounted && (
        <div className="fixed top-4 right-4 z-[100000] flex flex-col gap-2 max-w-sm">
          {toasts.map((toast) => {
            const config = getToastConfig(toast.type)
            return (
              <div
                key={toast.id}
                className={`
                  flex items-start gap-3 p-4 rounded-lg border-2 
                  ${config.bg} ${config.border} backdrop-blur-sm
                  animate-slide-in shadow-lg
                `}
              >
                <span className={config.text}>{config.icon}</span>
                <div className="flex-1">
                  <p className={`text-sm font-jaro ${config.text}`}>{config.title}</p>
                  <p className="text-sm font-inconsolata text-zinc-300">{toast.message}</p>
                </div>
                <button
                  onClick={() => removeToast(toast.id)}
                  className="text-zinc-400 hover:text-zinc-100 cursor-pointer"
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