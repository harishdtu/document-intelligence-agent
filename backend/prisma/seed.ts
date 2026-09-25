/**
 * Optional dev-seed script. Not required for grading; useful for poking at
 * the dashboard with a couple of rows before uploading real samples.
 * Run with: npx tsx prisma/seed.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.invoice.create({
    data: {
      vendorName: "Apex Office Supplies",
      invoiceNumber: "INV-2026-0417",
      invoiceDate: new Date("2026-03-12"),
      grandTotal: 662.0,
      status: "extracted",
      confidence: 0.97,
      documentType: "pdf_text",
      ocrUsed: false,
      extractionAttempts: 1,
      uncertainFields: [],
      sourceFileName: "invoice-01-standard.pdf",
      sourceFilePath: "seed/invoice-01-standard.pdf",
      mimeType: "application/pdf",
      lineItems: {
        create: [
          { description: "Multipurpose Copy Paper (500-ct ream)", quantity: 40, unitPrice: 6.25, total: 250.0, sortOrder: 0 },
          { description: "Black Toner Cartridge - HP Compatible", quantity: 6, unitPrice: 42.0, total: 252.0, sortOrder: 1 },
          { description: "Standard Stapler, Heavy Duty", quantity: 10, unitPrice: 8.5, total: 85.0, sortOrder: 2 },
          { description: "Ballpoint Pens, Box of 12", quantity: 20, unitPrice: 3.75, total: 75.0, sortOrder: 3 }
        ]
      }
    }
  });
  console.log("Seeded one sample invoice.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
