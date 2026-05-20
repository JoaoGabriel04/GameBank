import "dotenv/config";
import express from "express";
import cors from "cors";
import apiRouter from "./api/routes/index.js";
import { ensureGameData } from "./utils/ensureGameData.js";

const PORT = process.env.PORT || 7000;
const app = express();

const allowedOrigins = [
  "https://gamebankio.netlify.app",
  "http://localhost:3000" // para desenvolvimento local
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    }
  })
);

async function start() {
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use("/api", apiRouter);

  await ensureGameData();

  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}!`)
  })
}

start()