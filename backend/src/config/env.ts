/**
 * Centralized environment variable loading + validation.
 * Fails fast on startup with a clear message rather than surfacing
 * confusing errors deep in the request lifecycle.
 */
import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const boolFromString = z
  .string()
  .optional()
  .transform((v) => v === "true" || v === "1");

const EnvSchema = z.object({
  PORT: z.string().default("4000").transform(Number),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  MOCK_LLM: boolFromString,

  // OpenAI
  OPENAI_API_KEY: z.string().optional().default(""),
  OPENAI_MODEL: z.string().optional().default("gpt-4o-mini"),

  // Gemini
  GEMINI_API_KEY: z.string().optional().default(""),
  GEMINI_MODEL: z.string().optional().default("gemini-3.8-flash"),

  UPLOAD_DIR: z.string().default("uploads"),
  MAX_UPLOAD_SIZE_MB: z.string().default("15").transform(Number),

  CORS_ORIGIN: z.string().default("http://localhost:5173")
});

function loadEnv() {
  const parsed = EnvSchema.safeParse(process.env);

  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error("Invalid environment configuration:");

    // eslint-disable-next-line no-console
    console.error(parsed.error.flatten().fieldErrors);

    process.exit(1);
  }

  const env = parsed.data;

  // When using the real LLM, either OpenAI or Gemini must be configured.
  if (!env.MOCK_LLM && !env.OPENAI_API_KEY && !env.GEMINI_API_KEY) {
    // eslint-disable-next-line no-console
    console.error(
      "MOCK_LLM is false but no LLM API key is set. " +
      "Set GEMINI_API_KEY or OPENAI_API_KEY, " +
      "or set MOCK_LLM=true."
    );

    process.exit(1);
  }

  return env;
}

export const env = loadEnv();
export type Env = typeof env;