import { describe, it, expect } from "vitest";
import path from "path";
import { PdfParser } from "../../src/parsers/PdfParser";

const STANDARD = path.resolve(__dirname, "../../../samples/input/invoice-01-standard.pdf");
const MODERN = path.resolve(__dirname, "../../../samples/input/invoice-02-modern-layout.pdf");
const SCANNED = path.resolve(__dirname, "../../../samples/input/invoice-03-scanned-low-quality.pdf");
const MIME = "application/pdf";

describe("PdfParser", () => {
  it("extracts native text directly from a clean, standard-layout PDF (no OCR)", async () => {
    const parser = new PdfParser();
    const doc = await parser.parse(STANDARD, MIME, "invoice-01-standard.pdf");
    expect(doc.ocrUsed).toBe(false);
    expect(doc.documentType).toBe("pdf_text");
    expect(doc.text).toContain("Apex Office Supplies");
    expect(doc.text).toContain("INV-2026-0417");
  });

  it("extracts native text from a differently-laid-out PDF without needing OCR", async () => {
    const parser = new PdfParser();
    const doc = await parser.parse(MODERN, MIME, "invoice-02-modern-layout.pdf");
    expect(doc.ocrUsed).toBe(false);
    expect(doc.text).toContain("NORTHSTAR COMPONENTS");
  });

  // Slow: rasterizes + OCRs a full page via tesseract.js. Excluded from the
  // default fast run; enable with `RUN_OCR_TEST=1 npm test` once dependencies
  // are installed, since it cannot run in the no-network sandbox that
  // generated this repository.
  it.skipIf(!process.env.RUN_OCR_TEST)(
    "falls back to OCR for the image-only scanned PDF and flags low confidence",
    async () => {
      const parser = new PdfParser();
      const doc = await parser.parse(SCANNED, MIME, "invoice-03-scanned-low-quality.pdf");
      expect(doc.ocrUsed).toBe(true);
      expect(doc.documentType).toBe("scanned_image");
      expect(doc.text.length).toBeGreaterThan(0);
    },
    30000
  );
});
