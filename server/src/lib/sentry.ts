import * as Sentry from "@sentry/node"
import { nodeProfilingIntegration } from "@sentry/profiling-node"

export function initSentry() {
  if (process.env.NODE_ENV === "development") return

  if (!process.env.SENTRY_DSN) {
    // logger ainda não está disponível neste ponto do boot — console.warn intencional
    console.warn("[sentry] SENTRY_DSN não configurado — Sentry desabilitado")
    return
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    integrations: [
      nodeProfilingIntegration(),
    ],
    tracesSampleRate: 0.1,
    profilesSampleRate: 0.1,
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers["authorization"]
        delete event.request.headers["cookie"]
      }
      return event
    },
  })

  // logger ainda não está disponível neste ponto do boot — console.log intencional
  console.log("[sentry] Inicializado")
}

export { Sentry }
