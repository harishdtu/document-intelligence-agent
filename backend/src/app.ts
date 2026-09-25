import express from "express";
import cors from "cors";
import { env } from "./config/env";
import invoiceRoutes from "./routes/invoiceRoutes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { logger } from "./utils/logger";

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json());

  app.use((req, _res, next) => {
    logger.info(`${req.method} ${req.path}`);
    next();
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", mockLlm: env.MOCK_LLM, env: env.NODE_ENV });
  });

  app.use("/api/invoices", invoiceRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
