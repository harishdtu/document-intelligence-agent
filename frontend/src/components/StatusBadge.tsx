import type { InvoiceStatus } from "../types";

const STYLES: Record<InvoiceStatus, string> = {
  uploaded: "bg-slate-100 text-slate-700 border-slate-300",
  processing: "bg-blue-100 text-blue-700 border-blue-300 animate-pulse",
  extracted: "bg-emerald-100 text-emerald-700 border-emerald-300",
  needs_review: "bg-amber-100 text-amber-800 border-amber-300",
  reviewed: "bg-indigo-100 text-indigo-700 border-indigo-300",
  failed: "bg-red-100 text-red-700 border-red-300"
};

const LABELS: Record<InvoiceStatus, string> = {
  uploaded: "Uploaded",
  processing: "Processing…",
  extracted: "Extracted",
  needs_review: "Needs Review",
  reviewed: "Reviewed",
  failed: "Failed"
};

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  );
}
