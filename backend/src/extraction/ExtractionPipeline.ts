import type { LLMProvider } from "../llm/LLMProvider";
import { getParserFor } from "../parsers";
import { validateExtraction, rawOutputAsString } from "../validation/ExtractionValidator";
import { runBusinessValidation } from "../validation/BusinessRules";
import { scoreConfidence } from "./ConfidenceScorer";
import type { PipelineResult } from "../types";
import { logger } from "../utils/logger";

const MAX_ATTEMPTS = 2; // 1 normal attempt + 1 repair attempt, per the assignment spec

/**
 * The single place that runs:
 *   file -> parser (+ OCR fallback) -> LLM -> schema validation -> repair
 *        -> business validation -> confidence scoring -> PipelineResult
 *
 * Nothing outside this file decides whether an extraction is trustworthy.
 * InvoiceService only persists whatever this returns.
 */
export class ExtractionPipeline {
  constructor(private llm: LLMProvider) {}

  async run(filePath: string, mimeType: string, fileName: string): Promise<PipelineResult> {
    const parser = getParserFor(mimeType, fileName);
    const doc = await parser.parse(filePath, mimeType, fileName);

    let attempts = 0;
    let lastRawOutput: unknown = null;
    let lastErrors: string[] = [];

    while (attempts < MAX_ATTEMPTS) {
      attempts += 1;
      const isRepair = attempts > 1;

      const raw = await this.llm.extractInvoice(
        doc,
        isRepair
          ? { repairContext: { previousRawOutput: rawOutputAsString(lastRawOutput), validationErrors: lastErrors } }
          : undefined
      );
      lastRawOutput = raw;

      const validation = validateExtraction(raw);
      if (validation.valid && validation.data) {
        const business = runBusinessValidation(validation.data);
        const confidence = scoreConfidence({
          extraction: validation.data,
          business,
          doc,
          extractionAttempts: attempts
        });

        const status = confidence.needsReview ? "needs_review" : "extracted";

        logger.info("Extraction pipeline completed", {
          fileName,
          attempts,
          confidence: confidence.confidence,
          status
        });

        return {
          documentType: doc.documentType,
          ocrUsed: doc.ocrUsed,
          ocrMeanConfidence: doc.ocrMeanConfidence,
          parserWarnings: doc.warnings,
          extraction: validation.data,
          extractionAttempts: attempts,
          validation: {
            schemaValid: true,
            schemaErrors: [],
            arithmeticWarnings: business.warnings,
            lineItemArithmeticOk: business.lineItemArithmeticOk,
            grandTotalArithmeticOk: business.grandTotalArithmeticOk
          },
          confidence,
          status
        };
      }

      lastErrors = validation.errors;
      logger.warn("Extraction failed schema validation", { fileName, attempts, errors: lastErrors });
    }

    // Exhausted MAX_ATTEMPTS without producing schema-valid output.
    logger.error("Extraction failed after all attempts", { fileName, attempts, errors: lastErrors });
    return {
      documentType: doc.documentType,
      ocrUsed: doc.ocrUsed,
      ocrMeanConfidence: doc.ocrMeanConfidence,
      parserWarnings: doc.warnings,
      extraction: null,
      extractionAttempts: attempts,
      validation: {
        schemaValid: false,
        schemaErrors: lastErrors,
        arithmeticWarnings: [],
        lineItemArithmeticOk: false,
        grandTotalArithmeticOk: false
      },
      confidence: {
        confidence: 0,
        uncertainFields: [],
        needsReview: true,
        reasons: ["Extraction failed strict schema validation after retry/repair attempt."]
      },
      status: "failed",
      failureReason: `Schema validation failed after ${attempts} attempt(s): ${lastErrors.join("; ")}`
    };
  }
}
