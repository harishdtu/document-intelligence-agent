import fs from "fs";
import type { DocumentParser } from "./DocumentParser";
import type { NormalizedDocument } from "../types";
import { logger } from "../utils/logger";
import { createWorker } from "tesseract.js";
import sharp from "sharp";
import { createCanvas } from "@napi-rs/canvas";

export class OcrParser implements DocumentParser {
  supports(): boolean {
    return false;
  }

  async parse(
    filePath: string,
    _mimeType: string,
    fileName: string
  ): Promise<NormalizedDocument> {
    const warnings: string[] = [];

    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

    const pdfBuffer = fs.readFileSync(filePath);

    const loadingTask = pdfjs.getDocument({
  data: new Uint8Array(pdfBuffer),
});

    const pdf = await loadingTask.promise;

    const pageTexts: string[] = [];
    const confidences: number[] = [];

    const worker = await createWorker("eng");

    try {
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);

        const viewport = page.getViewport({
          scale: 2,
        });

        const canvas = createCanvas(
          Math.ceil(viewport.width),
          Math.ceil(viewport.height)
        );

        const context = canvas.getContext("2d");

        await page.render({
  canvas: canvas as any,
  canvasContext: context as any,
  viewport,
}).promise;

        const pngBuffer = canvas.toBuffer("image/png");

        const optimizedImage = await sharp(pngBuffer)
          .grayscale()
          .normalize()
          .png()
          .toBuffer();

        const result = await worker.recognize(optimizedImage);

        const text = (result.data.text || "").trim();

        if (text) {
          pageTexts.push(text);
        }

        const words = (result.data as any).words ?? [];

        for (const word of words) {
          if (typeof word.confidence === "number") {
            confidences.push(word.confidence);
          }
        }

        page.cleanup();
      }
    } finally {
      await worker.terminate();
      await pdf.cleanup();
    }

    const text = pageTexts.join("\n\n").trim();

    const meanConfidence =
      confidences.length > 0
        ? confidences.reduce((sum, value) => sum + value, 0) /
          confidences.length
        : undefined;

    if (text.length < 20) {
      warnings.push(
        "OCR produced very little text; document may be unreadable or blank."
      );
    }

    if (meanConfidence !== undefined && meanConfidence < 75) {
      warnings.push(
        `Mean OCR word confidence is low (${meanConfidence.toFixed(1)}%).`
      );
    }

    logger.info("OCR completed", {
      fileName,
      pages: pdf.numPages,
      textLength: text.length,
      meanConfidence,
    });

    return {
      documentType: "scanned_image",
      text,
      ocrUsed: true,
      ocrMeanConfidence: meanConfidence,
      warnings,
    };
  }
}