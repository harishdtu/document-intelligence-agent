import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LineItemTable } from "../LineItemTable";

const ITEMS = [{ description: "Widget", quantity: 2, unitPrice: 5, total: 10 }];

describe("LineItemTable", () => {
  it("renders existing line items", () => {
    render(<LineItemTable items={ITEMS} uncertainFields={[]} editable onChange={() => {}} />);
    expect(screen.getByDisplayValue("Widget")).toBeInTheDocument();
  });

  it("calls onChange with an added row when 'Add line item' is clicked", () => {
    const onChange = vi.fn();
    render(<LineItemTable items={ITEMS} uncertainFields={[]} editable onChange={onChange} />);
    fireEvent.click(screen.getByText("+ Add line item"));
    expect(onChange).toHaveBeenCalledWith([...ITEMS, { description: "", quantity: 0, unitPrice: 0, total: 0 }]);
  });

  it("disables inputs when not editable", () => {
    render(<LineItemTable items={ITEMS} uncertainFields={[]} editable={false} onChange={() => {}} />);
    expect(screen.getByDisplayValue("Widget")).toBeDisabled();
  });
});
