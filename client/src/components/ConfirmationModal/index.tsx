'use client'

import { motion, AnimatePresence } from "framer-motion"
import { backdrop, modalBox } from "@/lib/animations"
import Button1 from "../Button01"

type Props = {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  color?: 'green' | 'red' | 'blue' | 'orange' | 'purple'
  loading?: boolean
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  color = "green",
  loading = false
}: Props) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <motion.div
            variants={backdrop}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
          
          <motion.div
            variants={modalBox}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="relative w-full max-w-md mx-4 bg-zinc-900 border-2 border-zinc-700 rounded-xl p-6 shadow-2xl"
          >
        <div className="flex items-center justify-center mb-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            color === 'red' ? 'bg-red-500/20' : 
            color === 'green' ? 'bg-green-500/20' :
            color === 'blue' ? 'bg-blue-500/20' :
            'bg-amber-500/20'
          }`}>
            <span className={`text-2xl ${
              color === 'red' ? 'text-red-400' : 
              color === 'green' ? 'text-green-400' :
              color === 'blue' ? 'text-blue-400' :
              'text-amber-400'
            }`}>⚠️</span>
          </div>
        </div>

        <h2 className="text-xl font-jaro text-zinc-100 text-center mb-2">{title}</h2>
        
        <p className="text-zinc-400 text-center font-inconsolata text-sm mb-6">
          {message}
        </p>

        <div className="flex gap-4 justify-center">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-6 py-2 bg-zinc-800 text-zinc-300 rounded-lg font-inconsolata hover:bg-zinc-700 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {cancelText}
          </button>
          
          <Button1
            size="sm"
            color={color}
            handle={onConfirm}
            className="font-inconsolata"
            disabled={loading}
          >
            {loading ? "Processando..." : confirmText}
          </Button1>
          </div>
        </motion.div>
      </div>
      )}
    </AnimatePresence>
  )
}