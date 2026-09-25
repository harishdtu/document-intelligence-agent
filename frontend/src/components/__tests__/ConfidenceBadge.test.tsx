import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConfidenceBadge } from "../ConfidenceBadge";

describe("ConfidenceBadge", () => {
  it("renders a percentage for a numeric confidence", () => {
    render(<ConfidenceBadge confidence={0.93} />);
    expect(screen.getByText("93%")).toBeInTheDocument();
  });

  it("renders a placeholder when confidence is null", () => {
    render(<ConfidenceBadge confidence={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
