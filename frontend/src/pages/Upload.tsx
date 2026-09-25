import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { invoicesApi } from "../api/invoices";
import { ApiError } from "../api/client";

type Phase = "idle" | "uploading" | "extracting" | "done" | "error";

const ACCEPTED = [".pdf", ".xlsx", ".xls"];

export function Upload() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setFileName(file.name);

      const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
      if (!ACCEPTED.includes(ext)) {
        setError(`Unsupported file type "${ext}". Accepted types: ${ACCEPTED.join(", ")}`);
        setPhase("error");
        return;
      }
      const maxBytes = 15 * 1024 * 1024;
      if (file.size > maxBytes) {
        setError(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max size is 15 MB.`);
        setPhase("error");
        return;
      }

      try {
        setPhase("uploading");
        const uploaded = await invoicesApi.upload(file);

        setPhase("extracting");
        await invoicesApi.extract(uploaded.id);

        setPhase("done");
        navigate(`/invoices/${uploaded.id}`);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Something went wrong while processing the file.");
        setPhase("error");
      }
    },
    [navigate]
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold text-slate-900">Upload an invoice</h1>
      <p className="mb-6 text-sm text-slate-500">Accepted formats: PDF (native or scanned) and Excel (.xlsx / .xls).</p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-12 text-center transition ${
          dragOver ? "border-blue-400 bg-blue-50" : "border-slate-300 bg-white hover:border-slate-400"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(",")}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <p className="text-slate-600">Drag and drop a file here, or click to choose one</p>
        {fileName && <p className="mt-2 text-sm text-slate-400">{fileName}</p>}
      </div>

      {phase === "uploading" && <StatusLine text="Uploading file…" />}
      {phase === "extracting" && <StatusLine text="Running extraction pipeline (parsing, OCR if needed, LLM extraction, validation)…" />}
      {phase === "error" && error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}
    </div>
  );
}

function StatusLine({ text }: { text: string }) {
  return (
    <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
      <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
      {text}
    </div>
  );
}
