import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useInvoice } from "../hooks/useInvoice";
import { invoicesApi } from "../api/invoices";
import { ApiError } from "../api/client";
import { StatusBadge } from "../components/StatusBadge";
import { ConfidenceBadge } from "../components/ConfidenceBadge";
import { UncertainField } from "../components/UncertainField";
import { LineItemTable } from "../components/LineItemTable";
import type { LineItem } from "../types";

export function InvoiceReview() {
  const { id } = useParams<{ id: string }>();
  const { invoice, setInvoice, loading, error, refresh } = useInvoice(id);

  const [vendorName, setVendorName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [grandTotal, setGrandTotal] = useState<number>(0);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (!invoice) return;
    setVendorName(invoice.vendorName ?? "");
    setInvoiceNumber(invoice.invoiceNumber ?? "");
    setInvoiceDate(invoice.invoiceDate ?? "");
    setGrandTotal(invoice.grandTotal ?? 0);
    setLineItems(invoice.lineItems);
  }, [invoice]);

  if (loading) return <div className="mx-auto max-w-4xl px-4 py-16 text-center text-slate-500">Loading invoice…</div>;
  if (error || !invoice)
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center text-red-600">
        {error ?? "Invoice not found."} <Link to="/" className="text-blue-600 underline">Back to dashboard</Link>
      </div>
    );

  const uncertain = invoice.uncertainFields ?? [];
  const parserWarnings: string[] = (invoice.rawExtractionJson as any)?.parserWarnings ?? [];
  const arithmeticWarnings: string[] = (invoice.rawExtractionJson as any)?.validation?.arithmeticWarnings ?? [];
  const allWarnings = [...parserWarnings, ...arithmeticWarnings];

  const computedLineTotal = lineItems.reduce((sum, i) => sum + (Number(i.total) || 0), 0);
  const grandTotalMismatch = Math.abs(computedLineTotal - grandTotal) > 0.02;

  async function handleSave(markReviewed: boolean) {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const updated = await invoicesApi.correct(invoice!.id, {
        vendorName: vendorName || null,
        invoiceNumber: invoiceNumber || null,
        invoiceDate: invoiceDate || null,
        grandTotal,
        lineItems: lineItems.map((li) => ({
          description: li.description,
          quantity: Number(li.quantity),
          unitPrice: Number(li.unitPrice),
          total: Number(li.total)
        })),
        markReviewed
      });
      setInvoice(updated);
      setSaveSuccess(true);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Failed to save corrections.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link to="/" className="text-sm text-blue-600 hover:underline">
            ← All invoices
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">{invoice.sourceFileName}</h1>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={invoice.status} />
          <ConfidenceBadge confidence={invoice.confidence} />
        </div>
      </div>

      {invoice.status === "failed" && invoice.extractionError && (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <strong>Extraction failed:</strong> {invoice.extractionError}
        </div>
      )}

      {allWarnings.length > 0 && (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <strong className="block mb-1">Pipeline warnings</strong>
          <ul className="list-disc pl-5 space-y-0.5">
            {allWarnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Vendor name" uncertain={uncertain.includes("vendorName")}>
            <input className="input" value={vendorName} onChange={(e) => setVendorName(e.target.value)} />
          </Field>
          <Field label="Invoice number" uncertain={uncertain.includes("invoiceNumber")}>
            <input className="input" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
          </Field>
          <Field label="Invoice date" uncertain={uncertain.includes("invoiceDate")}>
            <input type="date" className="input" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
          </Field>
          <Field
            label="Grand total"
            uncertain={uncertain.includes("grandTotal")}
            reason={grandTotalMismatch ? `Sum of line items is $${computedLineTotal.toFixed(2)}` : undefined}
          >
            <input
              type="number"
              step="0.01"
              className="input"
              value={grandTotal}
              onChange={(e) => setGrandTotal(Number(e.target.value))}
            />
          </Field>
        </div>

        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Line items</h2>
        <LineItemTable items={lineItems} uncertainFields={uncertain} editable onChange={setLineItems} />

        {grandTotalMismatch && (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
            Grand total (${grandTotal.toFixed(2)}) does not match the sum of line items (${computedLineTotal.toFixed(2)}).
            You can still save, but double-check this before marking reviewed.
          </div>
        )}

        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
          <a
            href={invoicesApi.sourceUrl(invoice.id)}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-blue-600 hover:underline"
          >
            View source file
          </a>
          <div className="flex gap-2">
            {saveError && <span className="self-center text-sm text-red-600">{saveError}</span>}
            {saveSuccess && <span className="self-center text-sm text-emerald-600">Saved.</span>}
            <button
              disabled={saving}
              onClick={() => handleSave(false)}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Save corrections
            </button>
            <button
              disabled={saving}
              onClick={() => handleSave(true)}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Save &amp; mark reviewed
            </button>
          </div>
        </div>
      </div>

      <button
        onClick={() => refresh()}
        className="mt-4 text-xs text-slate-400 hover:text-slate-600"
      >
        Refresh from server
      </button>
    </div>
  );
}

function Field({
  label,
  uncertain,
  reason,
  children
}: {
  label: string;
  uncertain: boolean;
  reason?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">{label}</label>
      <UncertainField uncertain={uncertain} reason={reason}>
        {children}
      </UncertainField>
    </div>
  );
}
