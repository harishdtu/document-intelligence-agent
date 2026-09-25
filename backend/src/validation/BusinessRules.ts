import type { ExtractionResult } from "./schema";

/**
 * Currency/rounding tolerance. Invoices routinely have $0.01-$0.02 rounding
 * differences between line-item math and printed totals (per-unit rounding,
 * tax rounding, etc); flagging every one of those as a hard inconsistency
 * would make the system cry wolf constantly. Anything past this tolerance,
 * however, is treated as a genuine inconsistency worth surfacing.
 */
export const ARITHMETIC_TOLERANCE = 0.02;

export interface BusinessValidationOutcome {
  lineItemArithmeticOk: boolean;
  grandTotalArithmeticOk: boolean;
  warnings: string[];
  /** Indices of line items whose total didn't reconcile with quantity * unitPrice. */
  inconsistentLineItemIndexes: number[];
  dateParseable: boolean;
}

export function runBusinessValidation(extraction: ExtractionResult): BusinessValidationOutcome {
  const warnings: string[] = [];
  const inconsistentLineItemIndexes: number[] = [];

  let lineItemArithmeticOk = true;
  extraction.lineItems.forEach((item, idx) => {
    const expected = item.quantity * item.unitPrice;
    const diff = Math.abs(expected - item.total);
    if (diff > ARITHMETIC_TOLERANCE) {
      lineItemArithmeticOk = false;
      inconsistentLineItemIndexes.push(idx);
      warnings.push(
        `Line item ${idx} ("${item.description}"): quantity (${item.quantity}) x unitPrice (${item.unitPrice}) = ${expected.toFixed(
          2
        )}, but total is ${item.total.toFixed(2)} (diff ${diff.toFixed(2)}).`
      );
    }
    if (item.quantity < 0 || item.unitPrice < 0 || item.total < 0) {
      warnings.push(`Line item ${idx} ("${item.description}") has a negative value, which is not physically valid for an invoice line.`);
    }
  });

  let grandTotalArithmeticOk = true;
  if (extraction.grandTotal !== null) {
    const sum = extraction.lineItems.reduce((acc, item) => acc + item.total, 0);
    const diff = Math.abs(sum - extraction.grandTotal);
    if (diff > ARITHMETIC_TOLERANCE) {
      grandTotalArithmeticOk = false;
      warnings.push(
        `Sum of line item totals (${sum.toFixed(2)}) does not match grandTotal (${extraction.grandTotal.toFixed(2)}), diff ${diff.toFixed(2)}.`
      );
    }
  } else {
    warnings.push("grandTotal is null.");
  }

  let dateParseable = true;
  if (extraction.invoiceDate !== null) {
    const parsed = new Date(extraction.invoiceDate);
    dateParseable = !Number.isNaN(parsed.getTime());
    if (!dateParseable) {
      warnings.push(`invoiceDate "${extraction.invoiceDate}" could not be parsed as a valid date.`);
    }
  } else {
    warnings.push("invoiceDate is null.");
  }

  if (extraction.lineItems.length === 0) {
    warnings.push("No line items were extracted.");
  }

  return { lineItemArithmeticOk, grandTotalArithmeticOk, warnings, inconsistentLineItemIndexes, dateParseable };
}
