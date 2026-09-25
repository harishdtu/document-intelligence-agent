import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import path from "path";
import { createFakePrisma } from "./testUtils/fakePrisma";

// Replace the real Prisma client with an in-memory fake so these tests need
// no live Postgres instance, and replace the LLM factory with the
// deterministic MockLLMProvider so they need no OpenAI key / network access.
vi.mock("../src/db/prisma", () => ({ prisma: createFakePrisma() }));
vi.mock("../src/llm", async () => {
  const actual = await vi.importActual<typeof import("../src/llm")>("../src/llm");
  return { ...actual, createLLMProvider: () => new actual.MockLLMProvider() };
});

const { createApp } = await import("../src/app");
const { prisma } = (await import("../src/db/prisma")) as unknown as { prisma: ReturnType<typeof createFakePrisma> };

const STANDARD_PDF = path.resolve(__dirname, "../../samples/input/invoice-01-standard.pdf");

const app = createApp();

beforeEach(() => {
  prisma.__reset();
});

describe("POST /api/invoices/upload", () => {
  it("rejects a request with no file", async () => {
    const res = await request(app).post("/api/invoices/upload");
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("rejects an unsupported file type", async () => {
    const res = await request(app)
      .post("/api/invoices/upload")
      .attach("file", Buffer.from("hello"), { filename: "notes.txt", contentType: "text/plain" });
    expect(res.status).toBe(400);
  });

  it("accepts a valid PDF and creates an invoice with status 'uploaded'", async () => {
    const res = await request(app).post("/api/invoices/upload").attach("file", STANDARD_PDF);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("uploaded");
    expect(res.body.sourceFileName).toBe("invoice-01-standard.pdf");
    expect(res.body.id).toBeDefined();
  });
});

describe("full upload -> extract -> list -> get -> correct flow", () => {
  it("processes the standard sample invoice end to end", async () => {
    const uploadRes = await request(app).post("/api/invoices/upload").attach("file", STANDARD_PDF);
    const id = uploadRes.body.id;

    const extractRes = await request(app).post(`/api/invoices/${id}/extract`);
    expect(extractRes.status).toBe(200);
    expect(extractRes.body.status).toBe("extracted");
    expect(extractRes.body.vendorName).toBe("Apex Office Supplies");
    expect(extractRes.body.lineItems.length).toBe(4);
    expect(extractRes.body.confidence).toBeGreaterThan(0.9);

    const listRes = await request(app).get("/api/invoices");
    expect(listRes.status).toBe(200);
    expect(listRes.body.find((i: any) => i.id === id)).toBeDefined();

    const getRes = await request(app).get(`/api/invoices/${id}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.lineItems.length).toBe(4);

    const patchRes = await request(app)
      .patch(`/api/invoices/${id}`)
      .send({ vendorName: "Apex Office Supplies Inc.", markReviewed: true, reviewedBy: "jane@example.com" });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.vendorName).toBe("Apex Office Supplies Inc.");
    expect(patchRes.body.status).toBe("reviewed");
  });

  it("returns 404 when extracting a nonexistent invoice", async () => {
    const res = await request(app).post("/api/invoices/00000000-0000-0000-0000-000000000000/extract");
    expect(res.status).toBe(404);
  });

  it("rejects a correction whose line item arithmetic is inconsistent", async () => {
    const uploadRes = await request(app).post("/api/invoices/upload").attach("file", STANDARD_PDF);
    const id = uploadRes.body.id;
    await request(app).post(`/api/invoices/${id}/extract`);

    const res = await request(app)
      .patch(`/api/invoices/${id}`)
      .send({ lineItems: [{ description: "Bad row", quantity: 2, unitPrice: 5, total: 999 }] });

    expect(res.status).toBe(400);
  });

  it("rejects a correction with an invalid date", async () => {
    const uploadRes = await request(app).post("/api/invoices/upload").attach("file", STANDARD_PDF);
    const id = uploadRes.body.id;
    await request(app).post(`/api/invoices/${id}/extract`);

    const res = await request(app).patch(`/api/invoices/${id}`).send({ invoiceDate: "not-a-date" });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/health", () => {
  it("reports ok status and whether mock LLM mode is active", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});
