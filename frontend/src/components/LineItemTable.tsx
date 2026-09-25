import type { LineItem } from "../types";
import { UncertainField } from "./UncertainField";

interface Props {
  items: LineItem[];
  uncertainFields: string[];
  editable: boolean;
  onChange: (items: LineItem[]) => void;
}

function isUncertain(uncertainFields: string[], idx: number, field: string) {
  return uncertainFields.includes(`lineItems[${idx}].${field}`) || uncertainFields.includes(`lineItems[${idx}]`);
}

export function LineItemTable({ items, uncertainFields, editable, onChange }: Props) {
  function updateItem(idx: number, patch: Partial<LineItem>) {
    const next = items.map((item, i) => (i === idx ? { ...item, ...patch } : item));
    onChange(next);
  }

  function removeItem(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
  }

  function addItem() {
    onChange([...items, { description: "", quantity: 0, unitPrice: 0, total: 0 }]);
  }

  const computedTotal = items.reduce((sum, i) => sum + (Number(i.total) || 0), 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="py-2 pr-2">Description</th>
            <th className="py-2 px-2 w-24">Qty</th>
            <th className="py-2 px-2 w-32">Unit Price</th>
            <th className="py-2 px-2 w-32">Total</th>
            {editable && <th className="w-10" />}
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const rowUncertain =
              isUncertain(uncertainFields, idx, "total") ||
              isUncertain(uncertainFields, idx, "quantity") ||
              isUncertain(uncertainFields, idx, "unitPrice") ||
              isUncertain(uncertainFields, idx, "description");
            const expected = item.quantity * item.unitPrice;
            const arithmeticMismatch = Math.abs(expected - item.total) > 0.02;

            return (
              <tr key={idx} className="border-b border-slate-100 align-top">
                <td className="py-2 pr-2">
                  <UncertainField uncertain={isUncertain(uncertainFields, idx, "description")}>
                    <input
                      className="w-full rounded border border-slate-200 px-2 py-1 disabled:bg-slate-50"
                      value={item.description}
                      disabled={!editable}
                      onChange={(e) => updateItem(idx, { description: e.target.value })}
                    />
                  </UncertainField>
                </td>
                <td className="py-2 px-2">
                  <UncertainField uncertain={isUncertain(uncertainFields, idx, "quantity")}>
                    <input
                      type="number"
                      className="w-full rounded border border-slate-200 px-2 py-1 disabled:bg-slate-50"
                      value={item.quantity}
                      disabled={!editable}
                      onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                    />
                  </UncertainField>
                </td>
                <td className="py-2 px-2">
                  <UncertainField uncertain={isUncertain(uncertainFields, idx, "unitPrice")}>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full rounded border border-slate-200 px-2 py-1 disabled:bg-slate-50"
                      value={item.unitPrice}
                      disabled={!editable}
                      onChange={(e) => updateItem(idx, { unitPrice: Number(e.target.value) })}
                    />
                  </UncertainField>
                </td>
                <td className="py-2 px-2">
                  <UncertainField
                    uncertain={isUncertain(uncertainFields, idx, "total") || arithmeticMismatch}
                    reason={arithmeticMismatch ? `Qty × Unit Price = ${expected.toFixed(2)}, but total is ${item.total}` : undefined}
                  >
                    <input
                      type="number"
                      step="0.01"
                      className="w-full rounded border border-slate-200 px-2 py-1 disabled:bg-slate-50"
                      value={item.total}
                      disabled={!editable}
                      onChange={(e) => updateItem(idx, { total: Number(e.target.value) })}
                    />
                  </UncertainField>
                </td>
                {editable && (
                  <td className="py-2 pl-1 text-right">
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="text-slate-400 hover:text-red-600"
                      aria-label="Remove line item"
                    >
                      ✕
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-3 flex items-center justify-between">
        {editable ? (
          <button type="button" onClick={addItem} className="text-sm font-medium text-blue-600 hover:text-blue-800">
            + Add line item
          </button>
        ) : (
          <span />
        )}
        <div className="text-sm text-slate-600">
          Sum of line items: <span className="font-semibold text-slate-900">${computedTotal.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
