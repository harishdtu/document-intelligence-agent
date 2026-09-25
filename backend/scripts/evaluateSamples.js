"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
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
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const ExtractionPipeline_1 = require("../src/extraction/ExtractionPipeline");
const MockLLMProvider_1 = require("../src/llm/MockLLMProvider");
const SAMPLES_DIR = path_1.default.resolve(__dirname, "../../samples");
const INPUT_DIR = path_1.default.join(SAMPLES_DIR, "input");
const OUTPUT_FILE = path_1.default.join(SAMPLES_DIR, "evaluation-results.json");
const SAMPLES = [
    { file: "invoice-01-standard.pdf", mimeType: "application/pdf" },
    { file: "invoice-02-modern-layout.pdf", mimeType: "application/pdf" },
    { file: "invoice-03-scanned-low-quality.pdf", mimeType: "application/pdf" },
    {
        file: "invoice-04-excel.xlsx",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    }
];
async function main() {
    const pipeline = new ExtractionPipeline_1.ExtractionPipeline(new MockLLMProvider_1.MockLLMProvider());
    const results = [];
    for (const sample of SAMPLES) {
        const filePath = path_1.default.join(INPUT_DIR, sample.file);
        if (!fs_1.default.existsSync(filePath)) {
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
    fs_1.default.writeFileSync(OUTPUT_FILE, JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
    console.log(`\nWrote ${OUTPUT_FILE}`);
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=evaluateSamples.js.map