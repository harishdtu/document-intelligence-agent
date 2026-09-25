import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NormalizedDocument } from "../src/types";
import type { LLMProvider, RepairContext } from "../src/llm/LLMProvider";

const FIXED_DOC: NormalizedDocument = {
  documentType: "pdf_text",
  text: "Apex Office Supplies INV-2026-0417",
  ocrUsed: false,
  warnings: []
};

// The pipeline resolves a parser via ../parsers; replace it with a stub that
// always returns a fixed NormalizedDocument so these tests exercise the
// LLM -> validation -> confidence chain in isolation from real file I/O.
vi.mock("../src/parsers", () => ({
  getParserFor: () => ({
    supports: () => true,
    parse: async () => FIXED_DOC
  })
}));

// Import AFTER the mock is registered.
const { ExtractionPipeline } = await import("../src/extraction/ExtractionPipeline");
const { MockLLMProvider } = await import("../src/llm/MockLLMProvider");

class AlwaysMalformedProvider implements LLMProvider {
  async extractInvoice(): Promise<unknown> {
    return { totally: "wrong shape" };
  }
}

class FixedResultProvider implements LLMProvider {
  constructor(private result: unknown) {}
  async extractInvoice(): Promise<unknown> {
    return this.result;
  }
}

describe("ExtractionPipeline", () => {
  it("extracts successfully on the first attempt for clean input", async () => {
    const pipeline = new ExtractionPipeline(new MockLLMProvider());
    const result = await pipeline.run("/fake/path.pdf", "application/pdf", "invoice-01-standard.pdf");

    expect(result.status).toBe("extracted");
    expect(result.extractionAttempts).toBe(1);
    expect(result.extraction?.vendorName).toBe("Apex Office Supplies");
    expect(result.confidence.needsReview).toBe(false);
  });

  it("recovers via the repair/retry path when the first attempt is malformed", async () => {
    const pipeline = new ExtractionPipeline(new MockLLMProvider({ simulateMalformedFirstAttempt: true }));
    const result = await pipeline.run("/fake/path.pdf", "application/pdf", "invoice-01-standard.pdf");

    expect(result.extractionAttempts).toBe(2);
    expect(result.status).toBe("extracted");
    expect(result.extraction?.vendorName).toBe("Apex Office Supplies");
  });

  it("marks the invoice failed if the LLM is still malformed after the repair attempt", async () => {
    const pipeline = new ExtractionPipeline(new AlwaysMalformedProvider());
    const result = await pipeline.run("/fake/path.pdf", "application/pdf", "whatever.pdf");

    expect(result.status).toBe("failed");
    expect(result.extraction).toBeNull();
    expect(result.extractionAttempts).toBe(2);
    expect(result.failureReason).toMatch(/Schema validation failed/);
  });

  it("routes a schema-valid but arithmetically inconsistent extraction to needs_review", async () => {
    const inconsistent = {
      vendorName: "X",
      invoiceNumber: "1",
      invoiceDate: "2026-01-01",
      lineItems: [{ description: "Widget", quantity: 2, unitPrice: 5, total: 10 }],
      grandTotal: 9999 // does not match sum of line items
    };
    const pipeline = new ExtractionPipeline(new FixedResultProvider(inconsistent));
    const result = await pipeline.run("/fake/path.pdf", "application/pdf", "whatever.pdf");

    expect(result.status).toBe("needs_review");
    expect(result.validation?.grandTotalArithmeticOk).toBe(false);
    expect(result.confidence.uncertainFields).toContain("grandTotal");
  });

  it("does not silently invent line items when the LLM legitimately returns none", async () => {
    const noItems = {
      vendorName: "X",
      invoiceNumber: "1",
      invoiceDate: "2026-01-01",
      lineItems: [],
      grandTotal: null
    };
    const pipeline = new ExtractionPipeline(new FixedResultProvider(noItems));
    const result = await pipeline.run("/fake/path.pdf", "application/pdf", "whatever.pdf");

    expect(result.extraction?.lineItems).toEqual([]);
    expect(result.status).toBe("needs_review");
  });
});
