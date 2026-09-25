import type { Request, Response } from "express";
import { prisma } from "../db/prisma";
import { createLLMProvider } from "../llm";
import { InvoiceService } from "../services/InvoiceService";
import { InvoiceCorrectionSchema } from "../validation/schema";
import { ValidationError, NotFoundError } from "../utils/errors";
import fs from "fs";

const invoiceService = new InvoiceService(prisma, createLLMProvider());

export async function uploadInvoice(req: Request, res: Response) {
  if (!req.file) {
    throw new ValidationError("No file uploaded. Send a single file under the 'file' field.");
  }

  const invoice = await invoiceService.createUploadedInvoice({
    sourceFileName: req.file.originalname,
    sourceFilePath: req.file.path,
    mimeType: req.file.mimetype
  });

  res.status(201).json(serializeInvoice(invoice));
}

export async function extractInvoice(req: Request, res: Response) {
  const { id } = req.params;
  const invoice = await invoiceService.extract(id);
  res.status(200).json(serializeInvoice(invoice));
}

export async function listInvoices(_req: Request, res: Response) {
  const invoices = await invoiceService.list();
  res.status(200).json(invoices.map(serializeInvoice));
}

export async function getInvoice(req: Request, res: Response) {
  const { id } = req.params;
  const invoice = await invoiceService.getById(id);
  res.status(200).json(serializeInvoice(invoice));
}

export async function updateInvoice(req: Request, res: Response) {
  const { id } = req.params;
  const parsed = InvoiceCorrectionSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError("Invalid correction payload", parsed.error.flatten());
  }
  const updated = await invoiceService.correct(id, parsed.data);
  res.status(200).json(serializeInvoice(updated));
}

export async function downloadSource(req: Request, res: Response) {
  const { id } = req.params;
  const { path, fileName, mimeType } = await invoiceService.getSourceFilePath(id);
  if (!fs.existsSync(path)) {
    throw new NotFoundError(`Source file for invoice ${id} is no longer available on disk.`);
  }
  res.setHeader("Content-Type", mimeType);
  res.setHeader("Content-Disposition", `inline; filename="${fileName.replace(/"/g, "")}"`);
  fs.createReadStream(path).pipe(res);
}

/**
 * Converts Prisma's Decimal / Date types into plain JSON-friendly values and
 * exposes a stable response shape independent of the ORM's internal types.
 */
function serializeInvoice(invoice: any) {
  return {
    id: invoice.id,
    vendorName: invoice.vendorName,
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate ? new Date(invoice.invoiceDate).toISOString().slice(0, 10) : null,
    grandTotal: invoice.grandTotal !== null && invoice.grandTotal !== undefined ? Number(invoice.grandTotal) : null,
    status: invoice.status,
    confidence: invoice.confidence ?? null,
    documentType: invoice.documentType,
    ocrUsed: invoice.ocrUsed,
    extractionAttempts: invoice.extractionAttempts,
    extractionError: invoice.extractionError ?? null,
    uncertainFields: invoice.uncertainFields ?? [],
    sourceFileName: invoice.sourceFileName,
    mimeType: invoice.mimeType,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
    reviewedAt: invoice.reviewedAt ?? null,
    reviewedBy: invoice.reviewedBy ?? null,
    rawExtractionJson: invoice.rawExtractionJson ?? null,
    lineItems: (invoice.lineItems ?? []).map((li: any) => ({
      id: li.id,
      description: li.description,
      quantity: Number(li.quantity),
      unitPrice: Number(li.unitPrice),
      total: Number(li.total),
      uncertain: li.uncertain
    }))
  };
}
