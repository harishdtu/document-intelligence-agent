import type { PrismaClient } from "@prisma/client";
import type { LLMProvider } from "../llm/LLMProvider";
import { ExtractionPipeline } from "../extraction/ExtractionPipeline";
import { NotFoundError, ValidationError, AppError } from "../utils/errors";
import type { InvoiceCorrection } from "../validation/schema";
import { logger } from "../utils/logger";

export interface CreateInvoiceInput {
  sourceFileName: string;
  sourceFilePath: string;
  mimeType: string;
}

export class InvoiceService {
  private pipeline: ExtractionPipeline;

  constructor(private prisma: PrismaClient, llm: LLMProvider) {
    this.pipeline = new ExtractionPipeline(llm);
  }

  async createUploadedInvoice(input: CreateInvoiceInput) {
    return this.prisma.invoice.create({
      data: {
        sourceFileName: input.sourceFileName,
        sourceFilePath: input.sourceFilePath,
        mimeType: input.mimeType,
        status: "uploaded"
      }
    });
  }

  async extract(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundError(`Invoice ${invoiceId} not found`);

    await this.prisma.invoice.update({ where: { id: invoiceId }, data: { status: "processing" } });

    let result;
    try {
      result = await this.pipeline.run(invoice.sourceFilePath, invoice.mimeType, invoice.sourceFileName);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown extraction error";
      logger.error("Extraction threw an unexpected error", { invoiceId, error: message });
      return this.prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: "failed",
          extractionError: message,
          extractionAttempts: { increment: 1 }
        },
        include: { lineItems: true }
      });
    }

    if (result.status === "failed" || !result.extraction) {
      return this.prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: "failed",
          extractionError: result.failureReason ?? "Extraction failed",
          extractionAttempts: result.extractionAttempts,
          documentType: result.documentType,
          ocrUsed: result.ocrUsed,
          rawExtractionJson: result as unknown as object
        },
        include: { lineItems: true }
      });
    }

    const { extraction, confidence } = result;

    // Replace any prior line items for this invoice (re-extraction case) then
    // insert the freshly extracted set.
    await this.prisma.invoiceLineItem.deleteMany({ where: { invoiceId } });

    const updated = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        vendorName: extraction.vendorName,
        invoiceNumber: extraction.invoiceNumber,
        invoiceDate: extraction.invoiceDate ? new Date(extraction.invoiceDate) : null,
        grandTotal: extraction.grandTotal,
        status: result.status,
        confidence: confidence.confidence,
        documentType: result.documentType,
        ocrUsed: result.ocrUsed,
        extractionAttempts: result.extractionAttempts,
        extractionError: null,
        uncertainFields: confidence.uncertainFields,
        rawExtractionJson: result as unknown as object,
        lineItems: {
          create: extraction.lineItems.map((item, idx) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
            uncertain: confidence.uncertainFields.some((f) => f.startsWith(`lineItems[${idx}]`)),
            sortOrder: idx
          }))
        }
      },
      include: { lineItems: { orderBy: { sortOrder: "asc" } } }
    });

    return updated;
  }

  async list() {
    return this.prisma.invoice.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        vendorName: true,
        invoiceNumber: true,
        invoiceDate: true,
        grandTotal: true,
        status: true,
        confidence: true,
        documentType: true,
        sourceFileName: true,
        createdAt: true,
        updatedAt: true
      }
    });
  }

  async getById(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { lineItems: { orderBy: { sortOrder: "asc" } } }
    });
    if (!invoice) throw new NotFoundError(`Invoice ${id} not found`);
    return invoice;
  }

  async correct(id: string, correction: InvoiceCorrection) {
    const existing = await this.prisma.invoice.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError(`Invoice ${id} not found`);

    if (correction.invoiceDate) {
      const parsed = new Date(correction.invoiceDate);
      if (Number.isNaN(parsed.getTime())) {
        throw new ValidationError(`invoiceDate "${correction.invoiceDate}" is not a valid date`);
      }
    }

    if (correction.lineItems) {
      for (const [idx, item] of correction.lineItems.entries()) {
        const expected = item.quantity * item.unitPrice;
        if (Math.abs(expected - item.total) > 0.02) {
          throw new ValidationError(
            `lineItems[${idx}]: quantity (${item.quantity}) x unitPrice (${item.unitPrice}) = ${expected.toFixed(
              2
            )}, which does not match total (${item.total}). Fix the values before saving.`
          );
        }
      }
    }

    if (correction.lineItems) {
      await this.prisma.invoiceLineItem.deleteMany({ where: { invoiceId: id } });
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: {
        ...(correction.vendorName !== undefined ? { vendorName: correction.vendorName } : {}),
        ...(correction.invoiceNumber !== undefined ? { invoiceNumber: correction.invoiceNumber } : {}),
        ...(correction.invoiceDate !== undefined
          ? { invoiceDate: correction.invoiceDate ? new Date(correction.invoiceDate) : null }
          : {}),
        ...(correction.grandTotal !== undefined ? { grandTotal: correction.grandTotal } : {}),
        ...(correction.markReviewed
          ? { status: "reviewed", reviewedAt: new Date(), reviewedBy: correction.reviewedBy ?? "reviewer" }
          : {}),
        ...(correction.lineItems
          ? {
              lineItems: {
                create: correction.lineItems.map((item, idx) => ({
                  description: item.description,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  total: item.total,
                  uncertain: false,
                  sortOrder: idx
                }))
              }
            }
          : {})
      },
      include: { lineItems: { orderBy: { sortOrder: "asc" } } }
    });

    return updated;
  }

  async getSourceFilePath(id: string): Promise<{ path: string; fileName: string; mimeType: string }> {
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundError(`Invoice ${id} not found`);
    return { path: invoice.sourceFilePath, fileName: invoice.sourceFileName, mimeType: invoice.mimeType };
  }
}
