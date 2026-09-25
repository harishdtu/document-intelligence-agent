import type { NormalizedDocument } from "../types";

/**
 * Common contract every concrete parser implements. Keeping this tiny
 * (one file in, one NormalizedDocument out) is what lets the pipeline stay
 * agnostic to which concrete parser produced the text.
 */
export interface DocumentParser {
  /** Returns true if this parser can handle the given mime type / extension. */
  supports(mimeType: string, fileName: string): boolean;
  parse(filePath: string, mimeType: string, fileName: string): Promise<NormalizedDocument>;
}
