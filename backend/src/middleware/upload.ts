import multer from "multer";
import path from "path";
import { env } from "../config/env";
import { ensureUploadDir, uploadRoot, safeStoredFilename } from "../utils/fileStorage";
import { ALLOWED_EXTENSIONS, ALLOWED_MIME_TYPES } from "../parsers/detectType";
import { ValidationError } from "../utils/errors";

ensureUploadDir();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadRoot()),
  filename: (_req, file, cb) => cb(null, safeStoredFilename(file.originalname))
});

function fileFilter(_req: unknown, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  const ext = path.extname(file.originalname).toLowerCase();
  const extOk = ALLOWED_EXTENSIONS.includes(ext);
  const mimeOk = ALLOWED_MIME_TYPES.includes(file.mimetype);

  // Require the extension to be allowed; accept a slightly permissive MIME
  // check since browsers/OSes are inconsistent about the exact MIME string
  // for .xlsx. Extension + downstream parser-side detection is the real gate.
  if (!extOk) {
    return cb(new ValidationError(`Unsupported file extension "${ext}". Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`));
  }
  if (!mimeOk && ext !== ".xlsx" && ext !== ".xls") {
    return cb(new ValidationError(`Unsupported MIME type "${file.mimetype}" for extension "${ext}".`));
  }
  cb(null, true);
}

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024,
    files: 1
  }
});
