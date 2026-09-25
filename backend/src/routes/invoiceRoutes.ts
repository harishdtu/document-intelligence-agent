import { Router } from "express";
import { upload } from "../middleware/upload";
import { asyncHandler } from "../middleware/errorHandler";
import {
  uploadInvoice,
  extractInvoice,
  listInvoices,
  getInvoice,
  updateInvoice,
  downloadSource
} from "../controllers/invoiceController";

const router = Router();

router.post("/upload", upload.single("file"), asyncHandler(uploadInvoice));
router.post("/:id/extract", asyncHandler(extractInvoice));
router.get("/", asyncHandler(listInvoices));
router.get("/:id", asyncHandler(getInvoice));
router.get("/:id/source", asyncHandler(downloadSource));
router.patch("/:id", asyncHandler(updateInvoice));

export default router;
