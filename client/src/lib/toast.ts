import { toast as toastFunction } from 'react-toastify'

export const toast = {
  error: (message: string) => {
    toastFunction.error(message)
  },
  success: (message: string) => {
    toastFunction.success(message)
  },
  warning: (message: string) => {
    toastFunction.warning(message)
  },
  info: (message: string) => {
    toastFunction.info(message)
  },
}