export function ConfidenceBadge({ confidence }: { confidence: number | null }) {
  if (confidence === null) return <span className="text-xs text-slate-400">—</span>;

  const pct = Math.round(confidence * 100);
  const color =
    confidence >= 0.85 ? "text-emerald-700 bg-emerald-50" : confidence >= 0.75 ? "text-amber-700 bg-amber-50" : "text-red-700 bg-red-50";

  return <span className={`rounded px-2 py-0.5 text-xs font-semibold ${color}`}>{pct}%</span>;
}
