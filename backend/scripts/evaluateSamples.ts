/**
 * Runs the full extraction pipeline (parser -> OCR fallback -> MockLLM ->
 * validation -> confidence scoring) against the 4 bundled sample invoices,
 * with no database and no network access required. Writes
 * samples/evaluation-results.json summarizing status/confidence/warnings
 * for each, so a reviewer can see at a glance that the system does not
 * silently accept bad extractions.
 *
 * Usage: npm run evaluate:samples   (from backend/)
 *
 * NOTE: this could not be executed in the sandbox that generated this
 * repository (see README > Sandbox verification limitation). Run it
 * yourself after `npm install` to produce a real, non-fabricated result
 * file - this script is the source of truth, not the JSON it would emit.
 */
import fs from "fs";
import path from "path";
import { ExtractionPipeline } from "../src/extraction/ExtractionPipeline";
import { MockLLMProvider } from "../src/llm/MockLLMProvider";

const SAMPLES_DIR = path.resolve(__dirname, "../../samples");
const INPUT_DIR = path.join(SAMPLES_DIR, "input");
const OUTPUT_FILE = path.join(SAMPLES_DIR, "evaluation-results.json");

const SAMPLES: Array<{ file: string; mimeType: string }> = [
  { file: "invoice-01-standard.pdf", mimeType: "application/pdf" },
  { file: "invoice-02-modern-layout.pdf", mimeType: "application/pdf" },
  { file: "invoice-03-scanned-low-quality.pdf", mimeType: "application/pdf" },
  {
    file: "invoice-04-excel.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  }
];

async function main() {
  const pipeline = new ExtractionPipeline(new MockLLMProvider());
  const results = [];

  for (const sample of SAMPLES) {
    const filePath = path.join(INPUT_DIR, sample.file);
    if (!fs.existsSync(filePath)) {
      console.error(`Missing sample file: ${filePath}`);
      process.exitCode = 1;
      continue;
    }

    const result = await pipeline.run(filePath, sample.mimeType, sample.file);
    results.push({
      file: sample.file,
      status: result.status,
      confidence: result.confidence.confidence,
      documentType: result.documentType,
      ocrUsed: result.ocrUsed,
      ocrMeanConfidence: result.ocrMeanConfidence ?? null,
      extractionAttempts: result.extractionAttempts,
      extractedFields: result.extraction,
      validationWarnings: result.validation?.arithmeticWarnings ?? [],
      parserWarnings: result.parserWarnings,
      uncertainFields: result.confidence.uncertainFields,
      confidenceReasons: result.confidence.reasons
    });

    console.log(`${sample.file}: status=${result.status} confidence=${result.confidence.confidence}`);
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
  console.log(`\nWrote ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
