import { describe, it, expect } from "vitest";
import { scoreConfidence, CONFIDENCE_THRESHOLD_NEEDS_REVIEW } from "../src/extraction/ConfidenceScorer";
import { runBusinessValidation } from "../src/validation/BusinessRules";
import type { ExtractionResult } from "../src/validation/schema";
import type { NormalizedDocument } from "../src/types";

const CLEAN_EXTRACTION: ExtractionResult = {
  vendorName: "Apex",
  invoiceNumber: "INV-1",
  invoiceDate: "2026-03-12",
  lineItems: [{ description: "Widget", quantity: 2, unitPrice: 5, total: 10 }],
  grandTotal: 10
};

const CLEAN_DOC: NormalizedDocument = { documentType: "pdf_text", text: "irrelevant", ocrUsed: false, warnings: [] };

describe("scoreConfidence", () => {
  it("gives a clean native-text extraction high confidence and extracted status", () => {
    const business = runBusinessValidation(CLEAN_EXTRACTION);
    const outcome = scoreConfidence({ extraction: CLEAN_EXTRACTION, business, doc: CLEAN_DOC, extractionAttempts: 1 });
    expect(outcome.confidence).toBeGreaterThan(CONFIDENCE_THRESHOLD_NEEDS_REVIEW);
    expect(outcome.needsReview).toBe(false);
    expect(outcome.uncertainFields).toEqual([]);
  });

  it("penalizes OCR-derived documents even when OCR text looks fine", () => {
    const business = runBusinessValidation(CLEAN_EXTRACTION);
    const ocrDoc: NormalizedDocument = { ...CLEAN_DOC, documentType: "scanned_image", ocrUsed: true, ocrMeanConfidence: 95 };
    const outcome = scoreConfidence({ extraction: CLEAN_EXTRACTION, business, doc: ocrDoc, extractionAttempts: 1 });
    expect(outcome.confidence).toBeLessThan(1);
  });

  it("routes a low-OCR-confidence document to needs_review", () => {
    const business = runBusinessValidation(CLEAN_EXTRACTION);
    const badOcrDoc: NormalizedDocument = { ...CLEAN_DOC, documentType: "scanned_image", ocrUsed: true, ocrMeanConfidence: 55 };
    const outcome = scoreConfidence({ extraction: CLEAN_EXTRACTION, business, doc: badOcrDoc, extractionAttempts: 1 });
    expect(outcome.needsReview).toBe(true);
  });

  it("flags mathematically inconsistent totals as needing review regardless of raw score", () => {
    const inconsistent: ExtractionResult = {
      ...CLEAN_EXTRACTION,
      lineItems: [{ description: "Widget", quantity: 2, unitPrice: 5, total: 999 }]
    };
    const business = runBusinessValidation(inconsistent);
    const outcome = scoreConfidence({ extraction: inconsistent, business, doc: CLEAN_DOC, extractionAttempts: 1 });
    expect(outcome.needsReview).toBe(true);
    expect(outcome.uncertainFields).toContain("lineItems[0].total");
  });

  it("marks required-but-null fields as uncertain and lowers confidence", () => {
    const nulled: ExtractionResult = { ...CLEAN_EXTRACTION, invoiceDate: null };
    const business = runBusinessValidation(nulled);
    const outcome = scoreConfidence({ extraction: nulled, business, doc: CLEAN_DOC, extractionAttempts: 1 });
    expect(outcome.uncertainFields).toContain("invoiceDate");
    expect(outcome.confidence).toBeLessThan(1);
  });

  it("penalizes multiple retry attempts", () => {
    const business = runBusinessValidation(CLEAN_EXTRACTION);
    const oneAttempt = scoreConfidence({ extraction: CLEAN_EXTRACTION, business, doc: CLEAN_DOC, extractionAttempts: 1 });
    const twoAttempts = scoreConfidence({ extraction: CLEAN_EXTRACTION, business, doc: CLEAN_DOC, extractionAttempts: 2 });
    expect(twoAttempts.confidence).toBeLessThan(oneAttempt.confidence);
  });
});
