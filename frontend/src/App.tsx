import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { Dashboard } from "./pages/Dashboard";
import { Upload } from "./pages/Upload";
import { InvoiceReview } from "./pages/InvoiceReview";

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link to="/" className="font-semibold text-slate-900">
              📄 Document Intelligence Agent
            </Link>
          </div>
        </header>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/invoices/:id" element={<InvoiceReview />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
