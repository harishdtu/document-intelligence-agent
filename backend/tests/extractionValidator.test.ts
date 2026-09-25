import { describe, it, expect } from "vitest";
import { validateExtraction } from "../src/validation/ExtractionValidator";

const VALID = {
  vendorName: "Apex Office Supplies",
  invoiceNumber: "INV-1",
  invoiceDate: "2026-03-12",
  lineItems: [{ description: "Paper", quantity: 1, unitPrice: 10, total: 10 }],
  grandTotal: 10
};

describe("validateExtraction", () => {
  it("validates a plain object", () => {
    const outcome = validateExtraction(VALID);
    expect(outcome.valid).toBe(true);
    expect(outcome.data?.vendorName).toBe("Apex Office Supplies");
  });

  it("validates a JSON string (as OpenAI structured-output content arrives)", () => {
    const outcome = validateExtraction(JSON.stringify(VALID));
    expect(outcome.valid).toBe(true);
  });

  it("reports a parse error for malformed JSON text", () => {
    const outcome = validateExtraction("{not valid json");
    expect(outcome.valid).toBe(false);
    expect(outcome.errors[0]).toMatch(/not valid JSON/);
  });

  it("reports schema errors for a structurally wrong object", () => {
    const outcome = validateExtraction({ ...VALID, grandTotal: "ten dollars" });
    expect(outcome.valid).toBe(false);
    expect(outcome.errors.length).toBeGreaterThan(0);
  });

  it("rejects hallucinated extra top-level fields silently passing through unexpected types", () => {
    const outcome = validateExtraction({ ...VALID, lineItems: "not-an-array" });
    expect(outcome.valid).toBe(false);
  });
});
