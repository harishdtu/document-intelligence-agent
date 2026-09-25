import { describe, it, expect } from "vitest";
import { runBusinessValidation } from "../src/validation/BusinessRules";
import type { ExtractionResult } from "../src/validation/schema";

function extraction(overrides: Partial<ExtractionResult> = {}): ExtractionResult {
  return {
    vendorName: "Apex",
    invoiceNumber: "INV-1",
    invoiceDate: "2026-03-12",
    lineItems: [{ description: "Widget", quantity: 2, unitPrice: 5, total: 10 }],
    grandTotal: 10,
    ...overrides
  };
}

describe("runBusinessValidation", () => {
  it("passes for internally consistent numbers", () => {
    const outcome = runBusinessValidation(extraction());
    expect(outcome.lineItemArithmeticOk).toBe(true);
    expect(outcome.grandTotalArithmeticOk).toBe(true);
    expect(outcome.inconsistentLineItemIndexes).toEqual([]);
  });

  it("tolerates a sub-cent rounding difference", () => {
    const outcome = runBusinessValidation(
      extraction({ lineItems: [{ description: "Widget", quantity: 3, unitPrice: 3.333, total: 10 }] })
    );
    expect(outcome.lineItemArithmeticOk).toBe(true);
  });

  it("flags a line item whose total does not match quantity x unitPrice", () => {
    const outcome = runBusinessValidation(
      extraction({ lineItems: [{ description: "Widget", quantity: 2, unitPrice: 5, total: 50 }] })
    );
    expect(outcome.lineItemArithmeticOk).toBe(false);
    expect(outcome.inconsistentLineItemIndexes).toEqual([0]);
  });

  it("flags a grandTotal that does not match the sum of line items", () => {
    const outcome = runBusinessValidation(extraction({ grandTotal: 999 }));
    expect(outcome.grandTotalArithmeticOk).toBe(false);
  });

  it("flags an unparseable invoiceDate", () => {
    const outcome = runBusinessValidation(extraction({ invoiceDate: "not-a-date" }));
    expect(outcome.dateParseable).toBe(false);
  });

  it("warns (but does not throw) when grandTotal is null", () => {
    const outcome = runBusinessValidation(extraction({ grandTotal: null }));
    expect(outcome.warnings.some((w) => w.includes("grandTotal is null"))).toBe(true);
  });
});
