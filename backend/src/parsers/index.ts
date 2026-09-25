import type { DocumentParser } from "./DocumentParser";
import { PdfParser } from "./PdfParser";
import { ExcelParser } from "./ExcelParser";
import { AppError } from "../utils/errors";

const parsers: DocumentParser[] = [new PdfParser(), new ExcelParser()];

export function getParserFor(mimeType: string, fileName: string): DocumentParser {
  const parser = parsers.find((p) => p.supports(mimeType, fileName));
  if (!parser) {
    throw new AppError(`Unsupported file type for parsing: ${mimeType} (${fileName})`, 400);
  }
  return parser;
}
