/**
 * Minimal in-memory stand-in for PrismaClient, covering only the operations
 * InvoiceService actually calls. Lets InvoiceService and the API layer be
 * unit/integration tested deterministically without a live Postgres
 * instance, exactly the way MockLLMProvider avoids needing a live OpenAI key.
 *
 * This is NOT a general Prisma mock - it intentionally only implements the
 * subset of the query API this project uses.
 */
import { randomUUID } from "crypto";

interface FakeLineItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  uncertain: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

interface FakeInvoice {
  id: string;
  vendorName: string | null;
  invoiceNumber: string | null;
  invoiceDate: Date | null;
  grandTotal: number | null;
  status: string;
  confidence: number | null;
  documentType: string;
  ocrUsed: boolean;
  extractionAttempts: number;
  extractionError: string | null;
  uncertainFields: unknown;
  rawExtractionJson: unknown;
  sourceFileName: string;
  sourceFilePath: string;
  mimeType: string;
  reviewedAt: Date | null;
  reviewedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function createFakePrisma() {
  const invoices = new Map<string, FakeInvoice>();
  const lineItems = new Map<string, FakeLineItem>();

  function withLineItems(inv: FakeInvoice) {
    const items = Array.from(lineItems.values())
      .filter((li) => li.invoiceId === inv.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    return { ...inv, lineItems: items };
  }

  return {
    invoice: {
      async create({ data }: any) {
        const now = new Date();
        const id = randomUUID();
        const { lineItems: liInput, ...rest } = data;
        const inv: FakeInvoice = {
          id,
          vendorName: null,
          invoiceNumber: null,
          invoiceDate: null,
          grandTotal: null,
          status: "uploaded",
          confidence: null,
          documentType: "unknown",
          ocrUsed: false,
          extractionAttempts: 0,
          extractionError: null,
          uncertainFields: [],
          rawExtractionJson: null,
          reviewedAt: null,
          reviewedBy: null,
          createdAt: now,
          updatedAt: now,
          ...rest
        };
        invoices.set(id, inv);
        if (liInput?.create) {
          liInput.create.forEach((li: any, idx: number) => {
            const liId = randomUUID();
            lineItems.set(liId, { id: liId, invoiceId: id, createdAt: now, updatedAt: now, sortOrder: idx, uncertain: false, ...li });
          });
        }
        return withLineItems(inv);
      },
      async findUnique({ where }: any) {
        const inv = invoices.get(where.id);
        return inv ? withLineItems(inv) : null;
      },
      async findMany({ orderBy }: any = {}) {
        let all = Array.from(invoices.values());
        if (orderBy?.createdAt === "desc") {
          all = all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        return all.map(withLineItems);
      },
      async update({ where, data }: any) {
        const inv = invoices.get(where.id);
        if (!inv) throw new Error(`FakePrisma: invoice ${where.id} not found`);
        const { lineItems: liInput, ...rest } = data;

        for (const [key, value] of Object.entries(rest)) {
          if (value && typeof value === "object" && "increment" in (value as any)) {
            (inv as any)[key] = ((inv as any)[key] ?? 0) + (value as any).increment;
          } else {
            (inv as any)[key] = value;
          }
        }
        inv.updatedAt = new Date();

        if (liInput?.create) {
          liInput.create.forEach((li: any, idx: number) => {
            const liId = randomUUID();
            lineItems.set(liId, {
              id: liId,
              invoiceId: inv.id,
              createdAt: new Date(),
              updatedAt: new Date(),
              sortOrder: idx,
              uncertain: false,
              ...li
            });
          });
        }

        invoices.set(inv.id, inv);
        return withLineItems(inv);
      }
    },
    invoiceLineItem: {
      async deleteMany({ where }: any) {
        for (const [id, li] of lineItems.entries()) {
          if (li.invoiceId === where.invoiceId) lineItems.delete(id);
        }
        return { count: 0 };
      }
    },
    __reset() {
      invoices.clear();
      lineItems.clear();
    }
  };
}

export type FakePrisma = ReturnType<typeof createFakePrisma>;
