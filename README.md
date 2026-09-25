# Document Intelligence Agent — Messy Invoice Extraction

Extracts a common structured schema (vendor, invoice number, date, line
items, grand total) from vendor invoices that arrive in wildly different
formats — clean PDF, oddly-laid-out PDF, scanned/noisy PDF, and Excel — using
an LLM behind a strict validation and confidence pipeline, with a human
review UI for correcting anything the pipeline isn't sure about.

## Sandbox verification limitation

**Read this first.** This repository was generated in a sandboxed
environment with no network access: `npm install` could not reach the npm
registry, there was no live PostgreSQL instance, and there was no OpenAI API
access. Automated build/test/typecheck verification could not be executed in
the generation environment for those reasons. Everything below —
`npm install`, `npm run dev`, `npm test`, `npm run build`,
`npm run evaluate:samples` — is written to work on a normal machine with
network access, and the intended commands and configuration are included,
but none of them were actually run during generation.

What **was** done in the sandbox, without a live Node toolchain:
- Every relative TypeScript import in `backend/src` and `frontend/src` was
  checked programmatically to resolve to a real file (no dangling imports).
- Prisma schema field names were cross-checked against every place the
  backend code reads/writes them.
- The 4 sample documents were actually generated (not hand-copied) with
  Python (`reportlab`, `Pillow`, `openpyxl`, `img2pdf`), and the scanned PDF
  was verified with `pdfplumber` (confirms 0 characters of native text) and
  real Tesseract OCR (confirms what OCR actually returns and at what
  confidence — the numbers in `samples/output/invoice-03-*.json` are real
  Tesseract output, not invented).
- `samples/evaluation-results.json` was hand-derived from the same real OCR
  run and from manually tracing the documented `ConfidenceScorer` /
  `BusinessRules` logic against each sample's data — it says explicitly, in
  its own `_disclaimer` field, that it is not the output of an actual
  `npm run evaluate:samples` execution. Run that script yourself after
  `npm install` to get a real one.

Nothing in this README claims a build passed, a test suite passed, or a
typecheck was clean, because none of those were run.

## What it does

1. Upload a vendor invoice (PDF or Excel).
2. The backend detects the document type, extracts text (native PDF text,
   OCR fallback for scanned PDFs, or a normalized row-by-row dump for
   Excel), and sends that normalized text to an LLM with a strict JSON
   schema.
3. The LLM's response is validated against that schema (Zod), retried once
   with the validation errors fed back in if it's malformed, and checked
   against business rules (does `quantity × unitPrice ≈ total`? does the sum
   of line items ≈ the grand total?).
4. A deterministic, explainable confidence score is computed from observable
   signals (not the LLM's self-reported confidence) and used to decide
   `extracted` vs `needs_review` vs `failed`.
5. A human reviews flagged/all invoices in the UI, corrects fields, and
   marks them reviewed.

## Demo workflow

```
npm run install:all        # installs backend/ and frontend/ deps
cp backend/.env.example backend/.env      # MOCK_LLM=true by default — no API key needed
cp frontend/.env.example frontend/.env
# set up Postgres, run migrations (see "Database setup" below)
npm run backend:dev        # http://localhost:4000
npm run frontend:dev       # http://localhost:5173
```

Then in the browser: Upload → pick `samples/input/invoice-01-standard.pdf` →
watch it move through Uploading → Extracting → land on the review screen
already filled in and marked `extracted` with ~97% confidence. Try
`invoice-03-scanned-low-quality.pdf` and see it land on `needs_review` with
amber-highlighted fields and an explanation of why.

## Architecture

```
Upload
  |
File Validation (extension + MIME + size)
  |
Document Type Detection (pdf vs excel)
  |
Parser (PdfParser / ExcelParser)
  |
OCR Fallback (OcrParser, only if native PDF text is insufficient)
  |
Normalized Document (plain text/pseudo-table, common LLM input)
  |
LLM Structured Extraction (OpenAIProvider / MockLLMProvider, behind LLMProvider interface)
  |
Zod Schema Validation  --fails--> Repair/Retry (feed errors back to LLM) --fails again--> status: failed
  |  (passes)
Business Rule Validation (arithmetic, dates, non-negativity)
  |
Confidence Scoring (deterministic, signal-based) -> uncertainFields[]
  |
needs_review / extracted decision
  |
Postgres (Prisma) -- relational core fields + raw JSON for audit
  |
React Review UI (edit, correct, mark reviewed)
```

### Backend module layout

```
backend/src/
  config/env.ts            Zod-validated environment loading, fails fast
  parsers/
    DocumentParser.ts       common interface
    PdfParser.ts            native text extraction + OCR fallback trigger
    ExcelParser.ts          header-row-agnostic sheet -> text normalization
    OcrParser.ts            tesseract.js wrapper, tracks mean word confidence
    detectType.ts           mime/extension -> pdf | excel | unsupported
  llm/
    LLMProvider.ts           the one interface the rest of the app depends on
    OpenAIProvider.ts        real implementation (structured outputs)
    MockLLMProvider.ts       deterministic, network-free implementation
    prompt.ts                system prompt + JSON schema + repair prompt builder
  validation/
    schema.ts                Zod schema for LLM output AND for human corrections
    ExtractionValidator.ts   raw LLM output -> validated ExtractionResult | errors
    BusinessRules.ts         arithmetic/date/non-negativity checks
  extraction/
    ConfidenceScorer.ts      signals -> 0..1 score, uncertainFields, needsReview
    ExtractionPipeline.ts    orchestrates all of the above, owns the retry loop
  services/InvoiceService.ts persistence + orchestration, the only thing
                             controllers talk to
  controllers/, routes/       thin HTTP layer
  middleware/                 multer upload config, centralized error handler
  db/prisma.ts                Prisma client singleton
```

Each parser/validator/scorer is a small, independently testable unit; see
`backend/tests/` — the pipeline tests mock the parser layer, so LLM ->
validation -> confidence logic is tested with zero file I/O, and the parser
tests run the real parsers against the real bundled sample files.

## Data model

Two tables, Prisma-managed, targeting Postgres (Supabase-compatible):

**Invoice** — relational core fields (`vendorName`, `invoiceNumber`,
`invoiceDate`, `grandTotal`), pipeline/lifecycle state (`status`,
`confidence`, `documentType`, `ocrUsed`, `extractionAttempts`,
`extractionError`), `uncertainFields` (JSON array of field paths like
`"lineItems[1].unitPrice"`), and `rawExtractionJson` (the full pipeline
result — kept for audit/debugging, never the source of truth for the app's
own logic). Status is an enum:
`uploaded -> processing -> (extracted | needs_review | failed) -> reviewed`.

**InvoiceLineItem** — one row per line item, with a per-row `uncertain`
boolean, `sortOrder` to preserve document order, and a foreign key with
cascade delete (re-extracting or correcting an invoice's line items deletes
and recreates the set — see "Trade-offs").

Core invoice data is genuinely relational, not stuffed into a JSON blob —
`rawExtractionJson` is additive audit trail, not the primary read path.

## API

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/invoices/upload` | multipart upload (`file` field); validates extension/MIME/size; creates an `Invoice` row with `status: uploaded` |
| `POST` | `/api/invoices/:id/extract` | runs the full pipeline against the stored file; persists the result |
| `GET` | `/api/invoices` | list, sorted newest first, with vendor/number/date/total/status/confidence |
| `GET` | `/api/invoices/:id` | full invoice + line items + raw pipeline metadata |
| `PATCH` | `/api/invoices/:id` | human corrections; partial update; rejects a line item whose `quantity × unitPrice` doesn't match its `total` (>$0.02); `markReviewed: true` sets `status: reviewed` |
| `GET` | `/api/invoices/:id/source` | streams the original uploaded file |
| `GET` | `/api/health` | liveness + whether `MOCK_LLM` is active |

All errors are JSON: `{ "error": "<ErrorName>", "message": "...", "details"?: ... }`,
with correct status codes (400 validation, 404 not found, 500 unexpected).
See `backend/src/middleware/errorHandler.ts`.

## Extraction reliability

This is the part the assignment cares about most, so to be explicit:

- **Raw LLM output is never trusted.** It goes through `ExtractionValidator`
  (strict Zod schema — wrong types, missing keys, or a non-array `lineItems`
  are all rejected) before anything else touches it.
- **Retries are bounded and informed, not blind.** On a schema-validation
  failure, `ExtractionPipeline` sends the model its own previous output plus
  the specific validation errors and asks it to fix them (see
  `llm/prompt.ts#buildUserPrompt`'s repair branch), for at most one repair
  attempt (`MAX_ATTEMPTS = 2`). If it's still invalid, the invoice is marked
  `failed` with the validation errors recorded in `extractionError` — it is
  never silently accepted.
- **Business-rule validation is separate from schema validation.**
  `BusinessRules.ts` checks `quantity × unitPrice ≈ total` per line
  (tolerance $0.02, to absorb real rounding without absorbing real errors),
  `sum(line items) ≈ grandTotal`, non-negativity, and date parseability. A
  schema-valid but arithmetically inconsistent extraction is **always**
  routed to `needs_review`, regardless of the computed confidence score —
  see the `needsReview` calculation in `ConfidenceScorer.ts`.
- **The LLM is explicitly instructed to prefer `null` over invention** (see
  the numbered rules in `llm/prompt.ts#SYSTEM_PROMPT`): never invent a value,
  distinguish missing data from zero, don't fabricate or merge line items,
  don't "correct" values that look wrong. Extraction is not auditing.
- **OCR uncertainty is structural, not just textual.** `ConfidenceScorer`
  applies a flat penalty to every OCR-derived document regardless of how
  clean the OCR text looks (see `OCR_BASE_PENALTY` and the comment above
  it) — the reasoning is that per-word OCR confidence can be high while the
  document is still structurally ambiguous (e.g. a misread column header
  silently shifting which numbers line up with which column, which is
  exactly what happens in `samples/input/invoice-03-scanned-low-quality.pdf`,
  where OCR reads the `Qty` header as `yi`). A scanned document never
  reaches "auto-accept" confidence purely because individual characters OCR'd
  cleanly.

## Confidence strategy

`ConfidenceScorer.ts` starts at 1.0 and subtracts documented, additive
penalties for observable signals:

| Signal | Penalty |
|---|---|
| Document was OCR'd at all | flat −0.20 |
| Mean OCR word confidence < 80% | additional −0.15 |
| Mean OCR word confidence < 92% | no score penalty, but flags `invoiceNumber` and every `lineItems[i].quantity` as uncertain (short alphanumeric/numeric tokens are the most OCR-fragile) |
| Each parser warning | −0.03, capped at −0.10 total |
| Each retry beyond the first attempt | −0.10, capped at −0.20 total |
| `vendorName` / `invoiceNumber` / `invoiceDate` / `grandTotal` is `null` | −0.10 each, and flagged uncertain |
| Zero line items extracted | −0.30 |
| Line-item arithmetic inconsistent | −0.20, and the offending line's `total` flagged uncertain |
| Grand-total arithmetic inconsistent | −0.20, and `grandTotal` flagged uncertain |
| `invoiceDate` unparseable | −0.10, flagged uncertain |

Score is clamped to `[0, 1]`. `needsReview` is true if the score is below
`CONFIDENCE_THRESHOLD_NEEDS_REVIEW` (**0.75**) **or** if line-item/grand-total
arithmetic failed **or** if OCR mean confidence is below 80% — the last two
are hard triggers independent of the numeric score, because a
mathematically-broken invoice or a badly-scanned one should never slip
through purely by accumulating enough small positives elsewhere.

Every reason contributing to a score is recorded in `reasons: string[]` on
the result (see `PipelineResult.confidence.reasons`) and stored in
`rawExtractionJson`, so a reviewer (or a future engineer) can see exactly why
a given invoice landed where it did — this is explicitly not a black-box
number.

## Sample invoices

All 4 are generated (not hand-drawn/copied) by scripts in
`samples/scripts/`, using fictional vendors, with internally consistent
numbers (line items sum to the printed grand total in every sample).

| File | What makes it different | Expected result |
|---|---|---|
| `invoice-01-standard.pdf` | Clean native-text PDF, conventional single-column layout, standard labels | `extracted`, ~0.97 confidence, no warnings |
| `invoice-02-modern-layout.pdf` | Clean native-text PDF but right-aligned header, reordered table columns (`Qty / Item / Rate / Amount`), non-standard labels (`Doc Ref#`, `TOTAL DUE`) | `extracted`, ~0.93 confidence — demonstrates the pipeline isn't hard-coded to one template |
| `invoice-03-scanned-low-quality.pdf` | Genuinely image-only (0 characters of native text, verified with `pdfplumber`), rotated ~4.5°, Gaussian noise, blur, uneven shading, heavy JPEG recompression, real Tesseract OCR run against it | `needs_review`, ~0.58 confidence — flagged **by design** because it went through OCR, even though in this run Tesseract actually recovered every value correctly (see "Extraction reliability" above for why that's still the right call) |
| `invoice-04-excel.xlsx` | Title/subtitle/metadata block occupies rows 1–9, table header starts at row 11, non-standard column names (`Item`, `Units`, `Price/Unit`, `Line Amount`), totals block separated from the table by a blank row and labeled `AMOUNT DUE` instead of `Grand Total` | `extracted`, ~0.95 confidence — demonstrates the Excel normalizer doesn't assume row 1 is the header row |

Expected extraction JSON for each is in `samples/output/`. Do not read this
as "the system gets 3/4 documents perfectly and refuses to look at the 4th"
— all 4 documents extract to numerically correct data in this
implementation; the point of #3 is that the pipeline treats an OCR-derived
result with structural skepticism regardless of how the OCR run happens to
go, not that it's incapable of reading a scan.

## Setup

### Prerequisites
- Node.js 20+
- A Postgres database (local, Docker, or Supabase)
- (Optional) an OpenAI API key — not required, see "Running without an LLM"

### Install

```
npm run install:all
# equivalent to:
#   npm install --prefix backend
#   npm install --prefix frontend
```

### Environment variables

`backend/.env` (copy from `backend/.env.example`):

```
PORT=4000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/doc_intel_agent?schema=public"
MOCK_LLM=true
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
UPLOAD_DIR=uploads
MAX_UPLOAD_SIZE_MB=15
CORS_ORIGIN=http://localhost:5173
```

`frontend/.env` (copy from `frontend/.env.example`):

```
VITE_API_BASE_URL=http://localhost:4000/api
```

`config/env.ts` validates all of this with Zod at startup and exits with a
clear message if anything required is missing or malformed — including a
specific check that `OPENAI_API_KEY` is set whenever `MOCK_LLM` is not true.

### Database setup

Local Postgres:
```
createdb doc_intel_agent
cd backend
npx prisma migrate dev      # applies prisma/migrations/, generates the client
npx prisma generate
npx tsx prisma/seed.ts      # optional: one sample row for poking at the dashboard
```

Supabase: set `DATABASE_URL` in `backend/.env` to the connection-pooling URI
from Project Settings → Database, then run the same `prisma migrate dev` /
`prisma generate` commands.

`backend/prisma/migrations/0001_init/migration.sql` was hand-written to match
`prisma/schema.prisma` (Prisma itself couldn't generate it in the sandbox —
no live database to diff against). It works with `prisma migrate deploy`
as-is; if you'd rather have Prisma generate its own migration history, drop
that folder and run `prisma migrate dev` against an empty database instead.

### Running the app

```
npm run backend:dev     # http://localhost:4000, tsx watch mode
npm run frontend:dev    # http://localhost:5173, Vite dev server
```

Production builds: `npm run build --prefix backend` (tsc) and
`npm run build --prefix frontend` (tsc + vite build).

### Running without an LLM

`MOCK_LLM=true` (the default in `.env.example`) routes all extraction through
`MockLLMProvider`, which returns the known-correct extraction for each of the
4 bundled samples (matched by a distinctive substring in the normalized
text) and a small regex-based heuristic extraction for anything else. The
entire upload → extract → review → correct flow works with zero external
API calls or credentials. Set `MOCK_LLM=false` and `OPENAI_API_KEY=sk-...` to
use `OpenAIProvider` for real.

**API-version note:** `OpenAIProvider` is written against the `openai` npm
package v4.x `chat.completions.create` with
`response_format: { type: "json_schema", json_schema: {...} }` (Structured
Outputs), which was the documented pattern for GPT-4o-class models as of
this writing. This is the one file to check/update if OpenAI has since
changed the SDK surface — that's the entire reason `LLMProvider` exists as
an interface.

## Testing

```
npm run backend:test     # vitest run, backend/tests/**
npm run frontend:test    # vitest run, frontend component tests
```

Backend tests (all deterministic, no network, no live Postgres, no OpenAI
key required):

- `schema.test.ts` — Zod schema accepts valid/null-field extractions, rejects
  missing keys, wrong types, negative quantities, empty descriptions.
- `extractionValidator.test.ts` — handles both object and JSON-string input,
  reports parse errors vs schema errors distinctly.
- `businessRules.test.ts` — arithmetic tolerance, line-item and grand-total
  mismatches, unparseable dates.
- `confidenceScorer.test.ts` — clean doc scores high; OCR docs are penalized
  even with clean OCR text; low OCR confidence forces `needsReview`;
  arithmetic inconsistency forces `needsReview` regardless of score; retries
  lower confidence.
- `parsers/excelParser.test.ts` — runs the **real** parser against the real
  `samples/input/invoice-04-excel.xlsx`, asserting it captures both the
  metadata block above the table and the table itself.
- `parsers/pdfParser.test.ts` — runs the **real** parser against the real
  standard and modern-layout sample PDFs (native text, no OCR). The scanned-
  PDF OCR case is written but gated behind `RUN_OCR_TEST=1` since it's slow
  (rasterizes + OCRs a full page) — the underlying OCR quality was already
  verified for real during sample generation (see "What was done in the
  sandbox" above).
- `pipeline.test.ts` — the full LLM → validation → confidence chain with the
  parser layer mocked: happy path, repair/retry recovering a malformed first
  attempt, permanent failure after both attempts stay malformed, and
  arithmetically-inconsistent-but-schema-valid output being routed to
  `needs_review`.
- `api.invoices.test.ts` — full HTTP flow via `supertest` against the real
  Express app, with an **in-memory fake Prisma client**
  (`tests/testUtils/fakePrisma.ts`) and `MockLLMProvider` swapped in via
  `vi.mock`, so these need no live database either: upload validation,
  upload → extract → list → get → correct end-to-end, 404 on a nonexistent
  invoice, rejecting an arithmetically-inconsistent correction, rejecting an
  invalid date.

Frontend tests (`@testing-library/react` + `vitest`/`jsdom`):
`StatusBadge`, `ConfidenceBadge`, and `LineItemTable` (renders items, add-row
behavior, disables inputs when not editable).

**None of the above were actually executed** in the generation sandbox (no
`node_modules`). They're written to run cleanly once you `npm install`.

### Evaluating the samples

```
npm run evaluate:samples
```

Runs the real pipeline (real parsers + OCR + `MockLLMProvider`) against all 4
files in `samples/input/` and writes `samples/evaluation-results.json`
with status/confidence/extracted fields/warnings for each — the file
currently in the repo is a hand-derived placeholder with an explicit
disclaimer (see top of this README); this command overwrites it with a real
one.

## Trade-offs

- **Relational core fields + raw JSON, not "just store the JSON."** Vendor,
  invoice number, date, total, and line items are real columns so the
  dashboard/list/filter queries are normal SQL, not JSON path queries;
  `rawExtractionJson` is kept alongside purely for audit/debugging.
- **LLM structured extraction over a rules/regex engine.** Invoices are too
  layout-diverse (see samples 2 and 4) for a hand-written parser to
  generalize; the trade is that the LLM's output must never be trusted
  blindly, hence the validation/business-rule/confidence machinery being the
  majority of the backend code, not the LLM call itself.
- **OCR fallback via `tesseract.js` in-process**, not a hosted OCR API —
  keeps the whole pipeline runnable with zero additional credentials beyond
  Postgres, at the cost of OCR quality/speed versus a commercial API.
- **Field-level confidence via heuristics, not the LLM's self-reported
  confidence** — explicitly required by the assignment, and the right call
  regardless: a model has no real introspective access to whether it
  correctly read a blurry "3" as an "8".
- **Correcting line items replaces the whole set** rather than diffing
  individual rows — much simpler and correct for a take-home; the trade-off
  is losing per-row correction history (see "What I'd do differently").
- **Mock LLM provider with sample-matching + generic heuristic fallback**,
  not a fully generic mock — makes the bundled demo deterministic and
  correct without needing a key, while still not crashing on arbitrary
  uploads during a live demo.

## What I'd do differently with more time

- A specialized table-extraction step (e.g. layout-aware OCR or a
  table-detection model) instead of asking the LLM to infer column
  boundaries from a flattened text/row dump — this is the single biggest
  accuracy lever for messy scans and odd Excel layouts.
- An async job queue (BullMQ/pg-boss) for extraction instead of a synchronous
  `POST /extract` request, so large files or slow OCR don't hold an HTTP
  connection open.
- Per-line-item correction history / versioning instead of delete-and-
  recreate, so a reviewer's edit trail is auditable.
- Confidence calibration against a real labeled dataset instead of hand-
  chosen penalty constants — the current weights are principled but not
  empirically tuned.
- Field-level provenance (e.g. character/word bounding boxes or a text
  offset per extracted field) so the UI could highlight exactly where in the
  source document a value came from, not just that it's uncertain.
- Support for more invoice formats (multi-page invoices, CSV, email-embedded
  invoices) and multi-currency handling.
- Real observability (structured tracing per pipeline stage, not just log
  lines) for debugging extraction failures in production.

## Known limitations

- Verification (`npm install` / `npm test` / `npm run build` /
  `npx prisma migrate dev`) could not be executed in the generation
  environment — see the top of this README.
- `MockLLMProvider`'s generic fallback (for documents that aren't one of the
  4 bundled samples) is a simple regex heuristic, not a real extraction
  engine; it exists so an arbitrary demo upload doesn't hard-crash the app in
  mock mode, not to be a substitute for the real OpenAI path.
- Excel parsing only reads the first sheet of a multi-sheet workbook (with a
  warning surfaced to the pipeline output).
- No auth, by design (explicitly out of scope per the assignment) — do not
  deploy this as-is to a multi-tenant/public setting.
- OCR is CPU-bound `tesseract.js`; large or multi-page scanned PDFs will be
  noticeably slower than the native-text path.
- The correction API replaces the entire line-item set on any line-item
  edit; there's no per-row diff/audit trail (see "What I'd do differently").

## Evaluation checklist

| Requirement | Where |
|---|---|
| 4 sample formats (2 PDF, 1 scanned, 1 Excel) | `samples/input/` (actually generated, not renamed) |
| Common structured schema | `backend/src/validation/schema.ts` |
| Human review/correction | `PATCH /api/invoices/:id`, `frontend/src/pages/InvoiceReview.tsx` |
| Don't blindly trust the LLM | `ExtractionValidator` + `BusinessRules`, see "Extraction reliability" |
| Retry/repair on malformed output | `ExtractionPipeline.run` (`MAX_ATTEMPTS = 2`), tested in `pipeline.test.ts` |
| Explainable, non-LLM-self-reported confidence | `ConfidenceScorer.ts` |
| Flag the hard scanned doc instead of silently guessing | sample 3, `OCR_BASE_PENALTY`, see "Sample invoices" |
| Relational DB + Prisma | `backend/prisma/schema.prisma` |
| LLMProvider abstraction + Mock provider | `backend/src/llm/` |
| Node/Express/TS backend, React/TS/Tailwind frontend | throughout |
| Tests not dependent on network/LLM | all of `backend/tests/`, `frontend/src/components/__tests__/` |
| Evaluation script over the 4 samples | `backend/scripts/evaluateSamples.ts`, `npm run evaluate:samples` |
| Honest documentation of what wasn't/couldn't be verified | this section + top of README |
