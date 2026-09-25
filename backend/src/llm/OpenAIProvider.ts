import OpenAI from "openai";
import type { LLMProvider, RepairContext } from "./LLMProvider";
import type { NormalizedDocument } from "../types";
import { INVOICE_JSON_SCHEMA, SYSTEM_PROMPT, buildUserPrompt } from "./prompt";
import { env } from "../config/env";
import { logger } from "../utils/logger";

/**
 * Gemini provider using Google's OpenAI-compatible API.
 *
 * We intentionally keep the existing OpenAI SDK because Gemini supports
 * the OpenAI-compatible chat completions endpoint.
 *
 * Downstream Zod validation and repair logic remain unchanged.
 */
export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;

  constructor() {
    this.client = new OpenAI({
      apiKey: env.GEMINI_API_KEY,
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
    });

    this.model = env.GEMINI_MODEL;
  }

  async extractInvoice(
    input: NormalizedDocument,
    opts?: { repairContext?: RepairContext }
  ): Promise<unknown> {
    const userPrompt = buildUserPrompt(
      input,
      opts?.repairContext
    );

    const response = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT
        },
        {
          role: "user",
          content: userPrompt
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "invoice_extraction",
          strict: true,
          schema: INVOICE_JSON_SCHEMA
        }
      }
    });

    const raw = response.choices[0]?.message?.content ?? "";

    logger.debug("Gemini raw response received", {
      model: this.model,
      length: raw.length
    });

    try {
      return JSON.parse(raw);
    } catch {
      // Preserve the existing repair/retry pipeline.
      return raw;
    }
  }
}