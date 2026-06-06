// App Express mínimo para testes de integração — monta as MESMAS rotas de
// produção (apiRouter sob /api) sem efeitos colaterais: sem Socket.IO, sem
// rate limiter, sem listen, sem seed. NÃO altera o index.ts de produção.
import express from "express";
import cookieParser from "cookie-parser";
import apiRouter from "../../api/routes/index.js";
import { errorHandler } from "../../middleware/error-handler.middleware.js";

export function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use("/api", apiRouter);
  app.use(errorHandler);
  return app;
}
