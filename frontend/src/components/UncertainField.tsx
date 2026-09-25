import type { ReactNode } from "react";

/**
 * Wraps a form field with an amber highlight + warning icon when the
 * pipeline flagged it as uncertain, per the assignment's UX requirement:
 * "visually obvious but not obnoxious."
 */
export function UncertainField({
  uncertain,
  reason,
  children
}: {
  uncertain: boolean;
  reason?: string;
  children: ReactNode;
}) {
  if (!uncertain) return <>{children}</>;

  return (
    <div className="relative rounded-md ring-2 ring-amber-300 bg-amber-50/60 p-1" title={reason ?? "The extraction pipeline flagged this field as uncertain. Please review it."}>
      <div className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[11px] text-white shadow">
        !
      </div>
      {children}
    </div>
  );
}
