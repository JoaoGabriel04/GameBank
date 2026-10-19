// Chamado pelo entrypoint.prod.sh quando `prisma migrate deploy` falha:
// avisa o Sentry antes de o boot abortar (o app ainda não subiu, então o
// Sentry do servidor não está inicializado). Sem SENTRY_DSN, só registra
// no log do deploy. Nunca falha: o que importa é o exit 1 do entrypoint.
import * as Sentry from "@sentry/node";

const motivo = process.argv[2] ?? "falha no boot";

if (!process.env.SENTRY_DSN) {
  console.error(`[startup] SENTRY_DSN ausente — alerta não enviado: ${motivo}`);
  process.exit(0);
}

try {
  Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV });
  Sentry.captureMessage(`[startup] ${motivo}`, "fatal");
  await Sentry.flush(5000);
} catch (err) {
  console.error("[startup] não foi possível alertar o Sentry:", err);
}
