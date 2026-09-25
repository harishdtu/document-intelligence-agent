import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./utils/logger";

const app = createApp();

app.listen(env.PORT, () => {
  logger.info(`Document Intelligence Agent API listening on port ${env.PORT}`, {
    mockLlm: env.MOCK_LLM,
    nodeEnv: env.NODE_ENV
  });
});
