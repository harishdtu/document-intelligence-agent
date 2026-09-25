import { describe, it, expect } from "vitest";
import { ExtractionResultSchema, LineItemSchema } from "../src/validation/schema";

describe("ExtractionResultSchema", () => {
  it("accepts a fully valid extraction", () => {
    const result = ExtractionResultSchema.safeParse({
      vendorName: "Apex Office Supplies",
      invoiceNumber: "INV-1",
      invoiceDate: "2026-03-12",
      lineItems: [{ description: "Paper", quantity: 1, unitPrice: 10, total: 10 }],
      grandTotal: 10
    });
    expect(result.success).toBe(true);
  });

  it("accepts nulls for fields the model could not determine", () => {
    const result = ExtractionResultSchema.safeParse({
      vendorName: null,
      invoiceNumber: null,
      invoiceDate: null,
      lineItems: [],
      grandTotal: null
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing lineItems key", () => {
    const result = ExtractionResultSchema.safeParse({
      vendorName: "X",
      invoiceNumber: "1",
      invoiceDate: "2026-01-01",
      grandTotal: 10
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-numeric grandTotal", () => {
    const result = ExtractionResultSchema.safeParse({
      vendorName: "X",
      invoiceNumber: "1",
      invoiceDate: "2026-01-01",
      lineItems: [],
      grandTotal: "not-a-number"
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative quantity on a line item", () => {
    const result = LineItemSchema.safeParse({ description: "X", quantity: -1, unitPrice: 5, total: -5 });
    expect(result.success).toBe(false);
  });

  it("rejects a line item with an empty description", () => {
    const result = LineItemSchema.safeParse({ description: "", quantity: 1, unitPrice: 5, total: 5 });
    expect(result.success).toBe(false);
  });
});
