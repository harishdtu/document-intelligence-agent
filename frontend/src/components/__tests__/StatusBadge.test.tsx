import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "../StatusBadge";

describe("StatusBadge", () => {
  it("renders a human-readable label for needs_review", () => {
    render(<StatusBadge status="needs_review" />);
    expect(screen.getByText("Needs Review")).toBeInTheDocument();
  });

  it("renders a human-readable label for extracted", () => {
    render(<StatusBadge status="extracted" />);
    expect(screen.getByText("Extracted")).toBeInTheDocument();
  });
});
