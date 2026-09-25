import { describe, it, expect } from "vitest";
import path from "path";
import { ExcelParser } from "../../src/parsers/ExcelParser";

const SAMPLE = path.resolve(__dirname, "../../../samples/input/invoice-04-excel.xlsx");
const MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

describe("ExcelParser", () => {
  it("normalizes a workbook whose table does not start at row 1", async () => {
    const parser = new ExcelParser();
    const doc = await parser.parse(SAMPLE, MIME, "invoice-04-excel.xlsx");

    expect(doc.documentType).toBe("excel");
    expect(doc.ocrUsed).toBe(false);
    // Title/metadata rows above the real table are preserved...
    expect(doc.text).toContain("MERIDIAN TRADING CO.");
    expect(doc.text).toContain("Ref No:");
    // ...as is the actual line-item table, several rows further down.
    expect(doc.text).toContain("Imported Ceramic Tile");
    expect(doc.text).toContain("AMOUNT DUE");
  });

  it("supports() recognizes .xlsx by extension and mime type", () => {
    const parser = new ExcelParser();
    expect(parser.supports(MIME, "foo.xlsx")).toBe(true);
    expect(parser.supports("application/pdf", "foo.pdf")).toBe(false);
  });
});
