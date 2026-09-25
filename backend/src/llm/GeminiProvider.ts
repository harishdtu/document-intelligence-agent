import { GoogleGenAI, Type } from "@google/genai";
import type { LLMProvider, RepairContext } from "./LLMProvider";
import type { NormalizedDocument } from "../types";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt";
import { env } from "../config/env";
import { logger } from "../utils/logger";

export class GeminiProvider implements LLMProvider {
  private client: GoogleGenAI;
  private model: string;

  constructor() {
    this.client = new GoogleGenAI({
      apiKey: env.GEMINI_API_KEY
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

    const response = await this.client.models.generateContent({
      model: this.model,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${SYSTEM_PROMPT}\n\n${userPrompt}`
            }
          ]
        }
      ],
      config: {
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            vendorName: {
              type: Type.STRING,
              nullable: true
            },
            invoiceNumber: {
              type: Type.STRING,
              nullable: true
            },
            invoiceDate: {
              type: Type.STRING,
              nullable: true,
              description: "ISO 8601 date, e.g. 2026-03-12"
            },
            lineItems: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  description: {
                    type: Type.STRING
                  },
                  quantity: {
                    type: Type.NUMBER
                  },
                  unitPrice: {
                    type: Type.NUMBER
                  },
                  total: {
                    type: Type.NUMBER
                  }
                },
                required: [
                  "description",
                  "quantity",
                  "unitPrice",
                  "total"
                ]
              }
            },
            grandTotal: {
              type: Type.NUMBER,
              nullable: true
            }
          },
          required: [
            "vendorName",
            "invoiceNumber",
            "invoiceDate",
            "lineItems",
            "grandTotal"
          ]
        }
      }
    });

    const raw = response.text ?? "";

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