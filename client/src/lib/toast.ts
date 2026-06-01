type ToastFn = (message: string) => void

let _success: ToastFn = () => {}
let _error: ToastFn = () => {}
let _warning: ToastFn = () => {}
let _info: ToastFn = () => {}

export function registerToastFns(fns: {
  success: ToastFn
  error: ToastFn
  warning: ToastFn
  info: ToastFn
}) {
  _success = fns.success
  _error = fns.error
  _warning = fns.warning
  _info = fns.info
}

export const toast = {
  success: (message: string) => _success(message),
  error: (message: string) => _error(message),
  warning: (message: string) => _warning(message),
  info: (message: string) => _info(message),
}
