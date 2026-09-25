import type { ExtractionResult } from "../validation/schema";

export type DocumentTypeKind = "pdf_text" | "scanned_image" | "excel" | "unknown";

/**
 * The common representation every parser produces, and the only thing the
 * LLM extractor is allowed to see. Keeping this as a narrow interface is
 * what lets PdfParser / ExcelParser / OcrParser stay decoupled from the LLM
 * layer entirely.
 */
export interface NormalizedDocument {
  documentType: DocumentTypeKind;
  /** Best-effort plain text / pseudo-table representation of the document. */
  text: string;
  ocrUsed: boolean;
  /** Average per-word OCR confidence (0-100), only present when ocrUsed is true. */
  ocrMeanConfidence?: number;
  /** Non-fatal issues encountered while parsing (missing header row, empty sheet, etc). */
  warnings: string[];
}

export interface ValidationOutcome {
  schemaValid: boolean;
  schemaErrors: string[];
  arithmeticWarnings: string[];
  lineItemArithmeticOk: boolean;
  grandTotalArithmeticOk: boolean;
}

export interface ConfidenceOutcome {
  confidence: number; // 0..1
  uncertainFields: string[];
  needsReview: boolean;
  reasons: string[];
}

export interface PipelineResult {
  documentType: DocumentTypeKind;
  ocrUsed: boolean;
  ocrMeanConfidence?: number;
  parserWarnings: string[];
  extraction: ExtractionResult | null;
  extractionAttempts: number;
  validation: ValidationOutcome | null;
  confidence: ConfidenceOutcome;
  status: "extracted" | "needs_review" | "failed";
  failureReason?: string;
}
