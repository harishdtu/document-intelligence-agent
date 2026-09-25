import type { ExtractionResult } from "../validation/schema";
import type { BusinessValidationOutcome } from "../validation/BusinessRules";
import type { NormalizedDocument } from "../types";
import type { ConfidenceOutcome } from "../types";

/**
 * Below this score, an otherwise-successfully-parsed extraction is routed to
 * needs_review instead of extracted. Chosen so that a clean native-text
 * document with no warnings lands comfortably above it (~0.95+), while any
 * OCR-derived document starts closer to it by design (see OCR_BASE_PENALTY)
 * even before considering how well the OCR itself went.
 */
export const CONFIDENCE_THRESHOLD_NEEDS_REVIEW = 0.75;

/**
 * Flat penalty applied to every OCR-derived extraction, regardless of how
 * good the OCR text looks. Rationale (see README "Confidence strategy"):
 * per-word OCR confidence can be high while the document is still
 * structurally ambiguous (e.g. a misread column header silently shifting
 * which numbers line up with which column). We deliberately do not let a
 * scanned document reach "auto-accept" confidence purely because Tesseract
 * felt good about the characters it saw.
 */
const OCR_BASE_PENALTY = 0.2;

interface ScoreInputs {
  extraction: ExtractionResult;
  business: BusinessValidationOutcome;
  doc: NormalizedDocument;
  extractionAttempts: number;
}

export function scoreConfidence(input: ScoreInputs): ConfidenceOutcome {
  const { extraction, business, doc, extractionAttempts } = input;
  const reasons: string[] = [];
  const uncertainFields = new Set<string>();

  let score = 1.0;

  // --- Parser-level signals ---
  if (doc.ocrUsed) {
    score -= OCR_BASE_PENALTY;
    reasons.push(`OCR was used to read this document (flat penalty -${OCR_BASE_PENALTY.toFixed(2)}).`);

    if (doc.ocrMeanConfidence !== undefined) {
      if (doc.ocrMeanConfidence < 92) {
        // Short alphanumeric tokens (invoice numbers) and single/double-digit
        // numeric columns (quantities) are the most fragile under OCR noise
        // relative to how few characters they have to anchor a correct read.
        uncertainFields.add("invoiceNumber");
        extraction.lineItems.forEach((_, idx) => uncertainFields.add(`lineItems[${idx}].quantity`));
      }
      if (doc.ocrMeanConfidence < 80) {
        const penalty = 0.15;
        score -= penalty;
        reasons.push(`Mean OCR confidence ${doc.ocrMeanConfidence.toFixed(1)}% is low (additional penalty -${penalty}).`);
      }
    }
  }

  if (doc.warnings.length > 0) {
    const penalty = Math.min(0.1, doc.warnings.length * 0.03);
    score -= penalty;
    reasons.push(`${doc.warnings.length} parser warning(s) (penalty -${penalty.toFixed(2)}).`);
  }

  // --- Retry signal ---
  if (extractionAttempts > 1) {
    const penalty = Math.min(0.2, (extractionAttempts - 1) * 0.1);
    score -= penalty;
    reasons.push(`Extraction required ${extractionAttempts} attempt(s) (penalty -${penalty.toFixed(2)}).`);
  }

  // --- Required-field presence ---
  const requiredStringFields: Array<[keyof ExtractionResult, string]> = [
    ["vendorName", "vendorName"],
    ["invoiceNumber", "invoiceNumber"],
    ["invoiceDate", "invoiceDate"]
  ];
  for (const [key, label] of requiredStringFields) {
    if (extraction[key] === null) {
      score -= 0.1;
      uncertainFields.add(label);
      reasons.push(`${label} is null (penalty -0.10).`);
    }
  }
  if (extraction.grandTotal === null) {
    score -= 0.1;
    uncertainFields.add("grandTotal");
    reasons.push("grandTotal is null (penalty -0.10).");
  }

  // --- Structural completeness ---
  if (extraction.lineItems.length === 0) {
    score -= 0.3;
    reasons.push("No line items were extracted (penalty -0.30).");
  }

  // --- Business-rule signals ---
  if (!business.lineItemArithmeticOk) {
    score -= 0.2;
    business.inconsistentLineItemIndexes.forEach((idx) => uncertainFields.add(`lineItems[${idx}].total`));
    reasons.push("One or more line items fail quantity x unitPrice ≈ total (penalty -0.20).");
  }
  if (!business.grandTotalArithmeticOk) {
    score -= 0.2;
    uncertainFields.add("grandTotal");
    reasons.push("Sum of line item totals does not reconcile with grandTotal (penalty -0.20).");
  }
  if (!business.dateParseable) {
    score -= 0.1;
    uncertainFields.add("invoiceDate");
    reasons.push("invoiceDate could not be parsed (penalty -0.10).");
  }

  score = Math.max(0, Math.min(1, score));

  const needsReview =
    score < CONFIDENCE_THRESHOLD_NEEDS_REVIEW ||
    !business.lineItemArithmeticOk ||
    !business.grandTotalArithmeticOk ||
    (doc.ocrUsed && doc.ocrMeanConfidence !== undefined && doc.ocrMeanConfidence < 80);

  return {
    confidence: Math.round(score * 100) / 100,
    uncertainFields: Array.from(uncertainFields),
    needsReview,
    reasons
  };
}
