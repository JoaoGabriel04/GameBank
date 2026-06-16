import pino from "pino";

const isDev = process.env.NODE_ENV === "development";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  transport: isDev
    ? { target: "pino-pretty", options: { colorize: true } }
    : undefined,
  base: {
    service: "gamebank-server",
    env: process.env.NODE_ENV,
  },
  redact: {
    paths: [
      "password",
      "passwordHash",
      "token",
      "refreshToken",
      "authorization",
      "cookie",
      "req.headers.authorization",
    ],
    censor: "[REDACTED]",
  },
});

export const authLogger    = logger.child({ module: "auth" });
export const shopLogger    = logger.child({ module: "shop" });
export const sessionLogger = logger.child({ module: "session" });
export const socketLogger  = logger.child({ module: "socket" });
export const bauLogger     = logger.child({ module: "bau" });
export const missionLogger = logger.child({ module: "missions" });
