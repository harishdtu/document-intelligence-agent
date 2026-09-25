/**
 * Strict runtime schema for what the LLM is allowed to return.
 * This is the single source of truth for "shape of an extraction result"
 * and is used for both the LLM output and the human-correction PATCH payload.
 */
import { z } from "zod";

export const LineItemSchema = z.object({
  description: z.string().min(1, "line item description cannot be empty"),
  quantity: z.number().finite().nonnegative(),
  unitPrice: z.number().finite().nonnegative(),
  total: z.number().finite().nonnegative()
});

export type LineItem = z.infer<typeof LineItemSchema>;

/**
 * What we ask the LLM for, and what we validate its raw JSON response against
 * BEFORE we do any business-rule checking. Nullable fields reflect the
 * explicit instruction to the model: "if you cannot reliably determine a
 * value, return null" rather than inventing one.
 */
export const ExtractionResultSchema = z.object({
  vendorName: z.string().min(1).nullable(),
  invoiceNumber: z.string().min(1).nullable(),
  invoiceDate: z.string().min(1).nullable(), // ISO 8601 date string, validated further downstream
  lineItems: z.array(LineItemSchema).max(200),
  grandTotal: z.number().finite().nullable()
});

export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

/**
 * Payload accepted by PATCH /api/invoices/:id for human corrections.
 * Every field is optional (partial update); line items, when present,
 * fully replace the existing set (simplest correct semantics for a
 * take-home; documented in the README).
 */
export const InvoiceCorrectionSchema = z.object({
  vendorName: z.string().min(1).nullable().optional(),
  invoiceNumber: z.string().min(1).nullable().optional(),
  invoiceDate: z.string().min(1).nullable().optional(),
  grandTotal: z.number().finite().nullable().optional(),
  lineItems: z.array(LineItemSchema).optional(),
  markReviewed: z.boolean().optional(),
  reviewedBy: z.string().optional()
});

export type InvoiceCorrection = z.infer<typeof InvoiceCorrectionSchema>;

export const UploadQuerySchema = z.object({});

export function safeParseJson(raw: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "invalid JSON" };
  }
}
