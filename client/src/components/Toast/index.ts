'use client'

import { useToast as useToastHook, ToastProvider } from "./ToastProvider"

export { ToastProvider }
export const useToast = useToastHook

// Funções helper para usar fora de componentes
export function toastSuccess(message: string) {
  // Este será exportado e usado nos componentes
  return { success: message }
}