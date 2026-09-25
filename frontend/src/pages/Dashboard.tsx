import { Link } from "react-router-dom";
import { useInvoices } from "../hooks/useInvoices";
import { StatusBadge } from "../components/StatusBadge";
import { ConfidenceBadge } from "../components/ConfidenceBadge";

export function Dashboard() {
  const { invoices, loading, error, refresh } = useInvoices();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
          <p className="text-sm text-slate-500">Every document processed by the extraction pipeline.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => refresh()} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
            Refresh
          </button>
          <Link to="/upload" className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Upload invoice
          </Link>
        </div>
      </div>

      {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="py-16 text-center text-slate-500">Loading invoices…</div>
      ) : invoices.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 py-16 text-center text-slate-500">
          No invoices yet. <Link to="/upload" className="text-blue-600 underline">Upload one</Link> to get started.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Invoice #</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Confidence</th>
                <th className="px-4 py-3">Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link to={`/invoices/${inv.id}`} className="font-medium text-blue-700 hover:underline">
                      {inv.vendorName ?? <span className="italic text-slate-400">Unknown vendor</span>}
                    </Link>
                    <div className="text-xs text-slate-400">{inv.sourceFileName}</div>
                  </td>
                  <td className="px-4 py-3">{inv.invoiceNumber ?? "—"}</td>
                  <td className="px-4 py-3">{inv.invoiceDate ?? "—"}</td>
                  <td className="px-4 py-3">{inv.grandTotal !== null ? `$${inv.grandTotal.toFixed(2)}` : "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={inv.status} />
                  </td>
                  <td className="px-4 py-3">
                    <ConfidenceBadge confidence={inv.confidence} />
                  </td>
                  <td className="px-4 py-3 text-slate-500">{new Date(inv.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
