// Mirrors the JSON shape returned by the backend controllers
// (backend/src/controllers/invoiceController.ts#serializeInvoice).
// Kept as a single hand-written source of truth on the frontend since the
// two projects don't share a build step in this take-home; see README
// "Trade-offs" for why this wasn't wired up as a shared package.

export type InvoiceStatus = "uploaded" | "processing" | "extracted" | "needs_review" | "reviewed" | "failed";
export type DocumentType = "pdf_text" | "scanned_image" | "excel" | "unknown";

export interface LineItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  uncertain?: boolean;
}

export interface Invoice {
  id: string;
  vendorName: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  grandTotal: number | null;
  status: InvoiceStatus;
  confidence: number | null;
  documentType: DocumentType;
  ocrUsed: boolean;
  extractionAttempts: number;
  extractionError: string | null;
  uncertainFields: string[];
  sourceFileName: string;
  mimeType: string;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rawExtractionJson: unknown;
  lineItems: LineItem[];
}

export interface InvoiceCorrectionPayload {
  vendorName?: string | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  grandTotal?: number | null;
  lineItems?: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
  markReviewed?: boolean;
  reviewedBy?: string;
}

export interface ApiErrorBody {
  error: string;
  message: string;
  details?: unknown;
}
