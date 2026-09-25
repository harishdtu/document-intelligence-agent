import { ExtractionResultSchema, safeParseJson, type ExtractionResult } from "./schema";

export interface SchemaValidationOutcome {
  valid: boolean;
  data: ExtractionResult | null;
  errors: string[];
}

/**
 * Validates raw LLM output (which may be a JS object already, or a string
 * that needs JSON.parse'd first) against the strict Zod schema. This is the
 * gate between "whatever the model said" and "structured data the rest of
 * the system is allowed to trust the shape of" - it does not check business
 * logic (arithmetic, plausibility); see BusinessRules for that.
 */
export function validateExtraction(raw: unknown): SchemaValidationOutcome {
  let candidate: unknown = raw;

  if (typeof raw === "string") {
    const parsed = safeParseJson(raw);
    if (!parsed.ok) {
      return { valid: false, data: null, errors: [`Response was not valid JSON: ${parsed.error}`] };
    }
    candidate = parsed.value;
  }

  const result = ExtractionResultSchema.safeParse(candidate);
  if (!result.success) {
    const errors = result.error.errors.map((e) => `${e.path.join(".") || "(root)"}: ${e.message}`);
    return { valid: false, data: null, errors };
  }

  return { valid: true, data: result.data, errors: [] };
}

export function rawOutputAsString(raw: unknown): string {
  return typeof raw === "string" ? raw : JSON.stringify(raw);
}
