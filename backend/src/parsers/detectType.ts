import path from "path";

export type DetectedKind = "pdf" | "excel" | "unsupported";

const PDF_MIME = "application/pdf";
const EXCEL_MIMES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel" // .xls
]);

export function detectKind(mimeType: string, fileName: string): DetectedKind {
  const ext = path.extname(fileName).toLowerCase();

  if (mimeType === PDF_MIME || ext === ".pdf") return "pdf";
  if (EXCEL_MIMES.has(mimeType) || ext === ".xlsx" || ext === ".xls") return "excel";
  return "unsupported";
}

export const ALLOWED_EXTENSIONS = [".pdf", ".xlsx", ".xls"];
export const ALLOWED_MIME_TYPES = [PDF_MIME, ...Array.from(EXCEL_MIMES)];
