import type { LLMProvider, RepairContext } from "./LLMProvider";
import type { NormalizedDocument } from "../types";

/**
 * Deterministic, network-free stand-in for OpenAI. Used whenever
 * MOCK_LLM=true (the default in .env.example) and in every automated test,
 * so nothing about correctness depends on network access or a paid API key.
 *
 * Behavior:
 *  - For the four bundled sample documents, returns the known-correct
 *    extraction (recognized by a distinctive substring in the normalized
 *    text), so the whole app is demoable end-to-end with zero external
 *    dependencies.
 *  - For anything else, applies a small set of generic heuristics
 *    (regex-ish scans for "Invoice #", "Total", a date pattern) so arbitrary
 *    uploaded documents still get a plausible (if rougher) extraction
 *    instead of a hard failure.
 *  - Optionally simulates a malformed first attempt via
 *    `simulateMalformedFirstAttempt`, used by tests that exercise the
 *    retry/repair path deterministically.
 */
export class MockLLMProvider implements LLMProvider {
  constructor(private opts: { simulateMalformedFirstAttempt?: boolean } = {}) {}

  async extractInvoice(input: NormalizedDocument, opts?: { repairContext?: RepairContext }): Promise<unknown> {
    if (this.opts.simulateMalformedFirstAttempt && !opts?.repairContext) {
      // Missing required "lineItems" key entirely -> fails schema validation
      // -> exercises the repair/retry path deterministically in tests.
      return { vendorName: "Broken Co", invoiceNumber: "X-1", invoiceDate: "2026-01-01", grandTotal: "not-a-number" };
    }

    const text = input.text;

    if (text.includes("Apex Office Supplies")) {
      return {
        vendorName: "Apex Office Supplies",
        invoiceNumber: "INV-2026-0417",
        invoiceDate: "2026-03-12",
        lineItems: [
          { description: "Multipurpose Copy Paper (500-ct ream)", quantity: 40, unitPrice: 6.25, total: 250.0 },
          { description: "Black Toner Cartridge - HP Compatible", quantity: 6, unitPrice: 42.0, total: 252.0 },
          { description: "Standard Stapler, Heavy Duty", quantity: 10, unitPrice: 8.5, total: 85.0 },
          { description: "Ballpoint Pens, Box of 12", quantity: 20, unitPrice: 3.75, total: 75.0 }
        ],
        grandTotal: 662.0
      };
    }

    if (text.includes("NORTHSTAR COMPONENTS") || text.includes("Doc Ref#")) {
      return {
        vendorName: "Northstar Components",
        invoiceNumber: "NC-88213",
        invoiceDate: "2026-04-02",
        lineItems: [
          { description: "M3x10 Hex Bolt, Pack of 100", quantity: 15, unitPrice: 12.4, total: 186.0 },
          { description: "Aluminum Mounting Bracket, Type-B", quantity: 8, unitPrice: 34.5, total: 276.0 },
          { description: "CNC Assembly Service, Line 2", quantity: 3, unitPrice: 95.0, total: 285.0 }
        ],
        grandTotal: 747.0
      };
    }

    if (text.includes("BluePeak Services") || text.includes("BP-5521")) {
      return {
        vendorName: "BluePeak Services",
        invoiceNumber: "BP-5521",
        invoiceDate: "2026-03-28",
        lineItems: [
          { description: "On-site HVAC Inspection", quantity: 1, unitPrice: 180.0, total: 180.0 },
          { description: "Filter Replacement (20x25x1)", quantity: 4, unitPrice: 14.75, total: 59.0 },
          { description: "Emergency Call-Out Fee", quantity: 1, unitPrice: 120.0, total: 120.0 }
        ],
        grandTotal: 359.0
      };
    }

    if (text.includes("MERIDIAN TRADING") || text.includes("MTC-30845")) {
      return {
        vendorName: "Meridian Trading Co.",
        invoiceNumber: "MTC-30845",
        invoiceDate: "2026-05-09",
        lineItems: [
          { description: "Imported Ceramic Tile - 12x12 (box of 10)", quantity: 60, unitPrice: 22.5, total: 1350.0 },
          { description: "Packing Crate, Reinforced", quantity: 25, unitPrice: 18.0, total: 450.0 },
          { description: "Freight Handling Surcharge", quantity: 1, unitPrice: 200.0, total: 200.0 }
        ],
        grandTotal: 2000.0
      };
    }

    return this.genericHeuristicExtraction(text);
  }

  private genericHeuristicExtraction(text: string): unknown {
    const invoiceNumberMatch = text.match(/(?:invoice\s*#?|inv\.?|doc\s*ref#?)\s*:?\s*([A-Za-z0-9-]+)/i);
    const dateMatch = text.match(/(\d{4}-\d{2}-\d{2})/) || text.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
    const totalMatch = text.match(/(?:grand total|total due|amount due)\s*:?\s*\$?([\d,]+\.\d{2})/i);
    const vendorLine = text.split("\n").map((l) => l.trim()).find((l) => l.length > 0);

    return {
      vendorName: vendorLine || null,
      invoiceNumber: invoiceNumberMatch ? invoiceNumberMatch[1] : null,
      invoiceDate: dateMatch ? dateMatch[1] : null,
      lineItems: [],
      grandTotal: totalMatch ? Number(totalMatch[1].replace(/,/g, "")) : null
    };
  }
}
