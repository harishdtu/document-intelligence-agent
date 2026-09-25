import type { NormalizedDocument } from "../types";

/**
 * The only interface the rest of the system knows about. Swapping providers
 * (OpenAI -> Anthropic -> local model) means implementing this interface and
 * changing one line of wiring in llm/index.ts - nothing else in the
 * extraction pipeline needs to change.
 *
 * Returns unknown, not ExtractionResult: the provider's job is to produce
 * its best-effort JSON. Validating that JSON against the strict schema is
 * the ExtractionValidator's job, not the provider's - this keeps "talk to
 * the model" and "trust nothing it says" cleanly separated.
 */
export interface LLMProvider {
  extractInvoice(input: NormalizedDocument, opts?: { repairContext?: RepairContext }): Promise<unknown>;
}

/**
 * Passed back into the provider on a retry so it can see exactly what was
 * wrong with its previous attempt and correct it, rather than blindly
 * retrying the same prompt and likely producing the same mistake.
 */
export interface RepairContext {
  previousRawOutput: string;
  validationErrors: string[];
}
