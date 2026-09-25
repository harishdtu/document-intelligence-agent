import type { NormalizedDocument } from "../types";
import type { RepairContext } from "./LLMProvider";

export const INVOICE_JSON_SCHEMA = {
  type: "object",
  properties: {
    vendorName: { type: ["string", "null"] },
    invoiceNumber: { type: ["string", "null"] },
    invoiceDate: { type: ["string", "null"], description: "ISO 8601 date, e.g. 2026-03-12" },
    lineItems: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          quantity: { type: "number" },
          unitPrice: { type: "number" },
          total: { type: "number" }
        },
        required: ["description", "quantity", "unitPrice", "total"],
        additionalProperties: false
      }
    },
    grandTotal: { type: ["number", "null"] }
  },
  required: ["vendorName", "invoiceNumber", "invoiceDate", "lineItems", "grandTotal"],
  additionalProperties: false
} as const;

export const SYSTEM_PROMPT = `You are an information extraction engine for vendor invoices. You will be given the normalized text content of a single invoice document (which may have come from a native PDF text layer, OCR of a scanned image, or a spreadsheet).

Extract exactly this schema and return ONLY a single JSON object matching it - no prose, no markdown fences, no commentary:

{
  "vendorName": string | null,
  "invoiceNumber": string | null,
  "invoiceDate": string | null,   // ISO 8601 (YYYY-MM-DD) if determinable, else null
  "lineItems": [
    { "description": string, "quantity": number, "unitPrice": number, "total": number }
  ],
  "grandTotal": number | null
}

Rules you must follow exactly:
1. Never invent a value. If a field cannot be reliably determined from the document text, return null for that field (or omit the line item if a whole row is unreadable).
2. Preserve the invoice's own values exactly as written. Do not "correct" arithmetic, dates, or totals that look wrong to you - extraction is not auditing. Report what the document says.
3. Distinguish missing data from zero. A blank/absent quantity or price is null-worthy context for the caller, not 0. Only use 0 if the document literally shows a zero value.
4. Do not fabricate line items that are not present in the document, and do not merge or split line items that are shown as one row.
5. The document text may be noisy (OCR artifacts, misaligned columns, unusual labels like "Doc Ref#" instead of "Invoice Number", or a metadata block above the real table). Use context and position to map fields correctly, but do not guess wildly - prefer null over a low-confidence fabrication.
6. Return ONLY the JSON object described above. No surrounding text.`;

export function buildUserPrompt(doc: NormalizedDocument, repair?: RepairContext): string {
  const parts: string[] = [];

  if (repair) {
    parts.push(
      "Your previous response failed strict schema validation. Here is what you returned and what was wrong with it. Fix it and return a corrected JSON object following the schema and rules exactly.",
      "",
      "PREVIOUS OUTPUT:",
      repair.previousRawOutput,
      "",
      "VALIDATION ERRORS:",
      repair.validationErrors.map((e) => `- ${e}`).join("\n"),
      ""
    );
  }

  parts.push(
    `Document type: ${doc.documentType}${doc.ocrUsed ? " (text obtained via OCR - expect possible character-level noise)" : ""}`,
    "",
    "DOCUMENT TEXT:",
    doc.text
  );

  return parts.join("\n");
}
