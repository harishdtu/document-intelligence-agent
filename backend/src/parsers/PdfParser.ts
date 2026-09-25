import fs from "fs";
import type { DocumentParser } from "./DocumentParser";
import type { NormalizedDocument } from "../types";
import { detectKind } from "./detectType";
import { OcrParser } from "./OcrParser";
import { logger } from "../utils/logger";

const MIN_TEXT_LENGTH = 40;

export class PdfParser implements DocumentParser {
  private ocrParser = new OcrParser();

  supports(mimeType: string, fileName: string): boolean {
    return detectKind(mimeType, fileName) === "pdf";
  }

  async parse(
    filePath: string,
    mimeType: string,
    fileName: string
  ): Promise<NormalizedDocument> {
    const warnings: string[] = [];
    const buffer = fs.readFileSync(filePath);

    let extractedText = "";

    try {
      // pdfjs-dist is loaded dynamically because v6 is ESM-only.
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

      const loadingTask = pdfjs.getDocument({
  data: new Uint8Array(buffer)
});

      const pdf = await loadingTask.promise;

      const pages: string[] = [];

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();

        const pageText = content.items
          .map((item: any) => ("str" in item ? item.str : ""))
          .filter(Boolean)
          .join(" ");

        pages.push(pageText);
      }

      extractedText = pages.join("\n").trim();

      logger.info("Native PDF text extraction completed", {
        fileName,
        extractedLength: extractedText.length,
        pages: pdf.numPages
      });
    } catch (err) {
      warnings.push(
        `Native PDF text extraction failed (${
          err instanceof Error ? err.message : "unknown error"
        }); falling back to OCR.`
      );

      logger.warn("Native PDF extraction failed", {
        fileName,
        error: err instanceof Error ? err.message : String(err)
      });
    }

    if (extractedText.length >= MIN_TEXT_LENGTH) {
      return {
        documentType: "pdf_text",
        text: extractedText,
        ocrUsed: false,
        warnings
      };
    }

    logger.info("PDF text layer insufficient, falling back to OCR", {
      fileName,
      extractedLength: extractedText.length
    });

    warnings.push(
      `Native text layer had only ${extractedText.length} characters (threshold ${MIN_TEXT_LENGTH}); document is likely a scanned image. Used OCR fallback.`
    );

    const ocrResult = await this.ocrParser.parse(
      filePath,
      mimeType,
      fileName
    );

    return {
      ...ocrResult,
      warnings: [...warnings, ...ocrResult.warnings]
    };
  }
}