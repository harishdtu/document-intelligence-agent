import fs from "fs";
import path from "path";
import crypto from "crypto";
import { env } from "../config/env";

const UPLOAD_ROOT = path.resolve(process.cwd(), env.UPLOAD_DIR);

export function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_ROOT)) {
    fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
  }
}

/**
 * Builds a safe, collision-resistant filename on disk while preserving the
 * original extension. Never trusts the client-supplied name for the actual
 * path used on disk (defends against path traversal / overwrite attacks).
 */
export function safeStoredFilename(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  const id = crypto.randomUUID();
  return `${id}${ext}`;
}

export function uploadPathFor(storedFilename: string): string {
  return path.join(UPLOAD_ROOT, storedFilename);
}

export function uploadRoot(): string {
  return UPLOAD_ROOT;
}
