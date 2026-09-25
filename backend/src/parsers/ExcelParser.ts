import * as XLSX from "xlsx";
import type { DocumentParser } from "./DocumentParser";
import type { NormalizedDocument } from "../types";
import { detectKind } from "./detectType";

/**
 * Converts an arbitrary workbook into a normalized pseudo-table text blob
 * for the LLM. Deliberately does NOT assume the header row is row 1 or that
 * every sheet uses the same column names - real-world vendor invoices in
 * Excel routinely have a title/metadata block above the actual table (see
 * samples/input/invoice-04-excel.xlsx for a concrete example).
 *
 * Strategy: emit every non-empty row, tab-separated, prefixed with its
 * 1-based row number. This preserves layout information (which the LLM can
 * use to distinguish "metadata row" from "table row") without us having to
 * correctly guess the header row ourselves - that judgment call is left to
 * the LLM extraction step, which sees the whole sheet.
 */
export class ExcelParser implements DocumentParser {
  supports(mimeType: string, fileName: string): boolean {
    return detectKind(mimeType, fileName) === "excel";
  }

  async parse(filePath: string): Promise<NormalizedDocument> {
    const warnings: string[] = [];
    const workbook = XLSX.readFile(filePath, { cellDates: true });

    if (workbook.SheetNames.length === 0) {
      warnings.push("Workbook contains no sheets.");
      return { documentType: "excel", text: "", ocrUsed: false, warnings };
    }

    if (workbook.SheetNames.length > 1) {
      warnings.push(
        `Workbook has ${workbook.SheetNames.length} sheets; only the first sheet ("${workbook.SheetNames[0]}") was used.`
      );
    }

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      blankrows: false,
      defval: ""
    });

    if (rows.length === 0) {
      warnings.push("First sheet has no non-empty rows.");
    }

    const lines = rows.map((row, idx) => {
      const cells = row.map((cell) => (cell === "" || cell === null || cell === undefined ? "" : String(cell).trim()));
      return `Row ${idx + 1}: ${cells.join(" | ")}`;
    });

    return {
      documentType: "excel",
      text: lines.join("\n"),
      ocrUsed: false,
      warnings
    };
  }
}
