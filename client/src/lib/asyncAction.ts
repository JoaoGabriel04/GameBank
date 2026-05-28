import { AxiosError } from 'axios'

interface BaseState {
  loading: boolean
  error: string | null
}

interface AsyncActionParams<T extends BaseState> {
  set: (state: Partial<T>) => void
  get: () => T
  action: () => Promise<unknown>
  onSuccess?: () => void
  onError?: (message: string) => void
}

export function createAsyncAction<T extends BaseState>(params: AsyncActionParams<T>) {
  return async function execute() {
    const { set, get, action, onSuccess, onError } = params

    set({ loading: true, error: null } as Partial<T>)

    try {
      await action()
      onSuccess?.()
      set({ loading: false } as Partial<T>)
    } catch (err) {
      let errorMessage = 'Erro desconhecido'

      if (err instanceof AxiosError) {
        errorMessage = err.response?.data?.message || err.message
      } else if (err instanceof Error) {
        errorMessage = err.message
      }

      onError?.(errorMessage)
      set({ error: errorMessage, loading: false } as Partial<T>)
    }
  }
}

export function createErrorHandler<T extends BaseState>(set: (state: Partial<T>) => void) {
  return (err: unknown) => {
    let errorMessage = 'Erro desconhecido'

    if (err instanceof AxiosError) {
      errorMessage = err.response?.data?.message || err.message
    } else if (err instanceof Error) {
      errorMessage = err.message
    }

    set({ error: errorMessage, loading: false } as Partial<T>)
  }
}