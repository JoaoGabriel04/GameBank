import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import apiRouter from "./api/routes/index.js";
import { ensureGameData } from "./utils/ensureGameData.js";
import { errorHandler } from "./middleware/error-handler.middleware.js";
import { initSocket } from "./lib/socket.js";

process.on("unhandledRejection", (reason) => {
  console.error("[UNHANDLED_REJECTION]", reason);
});

const PORT = process.env.PORT || 7000;
const app = express();

const corsOriginsEnv = process.env.CORS_ORIGIN?.trim() || "";
const allowedOrigins = corsOriginsEnv
  ? corsOriginsEnv.split(",").map(s => s.trim())
  : ["http://localhost:3000"];

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", "http://localhost:7000", "https://sgpcontroller.onrender.com"],
        fontSrc: ["'self'", "https:", "data:"],
        imgSrc: ["'self'", "data:"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "https:", "'unsafe-inline'"],
        upgradeInsecureRequests: null,
      },
    },
  })
);
app.use(
  helmet.hsts({ maxAge: 31536000, includeSubDomains: true })
);

app.use(
  cors({
    origin: function (origin, callback) {
      const wildcard = allowedOrigins.includes("*");
      if (!origin || wildcard || allowedOrigins.includes(origin)) {
        callback(null, origin || true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

const baseRateLimit = {
  standardHeaders: true,
  legacyHeaders: false,
};

function createAuthLimiter() {
  return rateLimit({
    ...baseRateLimit,
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: "Muitas requisições. Tente novamente em 15 minutos." },
  });
}

function createApiLimiter() {
  return rateLimit({
    ...baseRateLimit,
    windowMs: 60 * 1000,
    max: 300,
    message: { error: "Muitas requisições. Tente novamente em 1 minuto." },
  });
}

const httpServer = createServer(app);

async function start() {
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  await initSocket(httpServer);

  app.use("/api/auth", createAuthLimiter());
  app.use("/api", createApiLimiter());
  app.use("/api", apiRouter);

  app.use(errorHandler);

  await ensureGameData();

  httpServer.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}!`)
  })
}

start()