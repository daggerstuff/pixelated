import { render, screen } from "@testing-library/react";
import { ProgressBar } from "../ProgressBar";
import { describe, expect, it } from "vitest";

describe("ProgressBar", () => {
  it("renders progress bar with correct value and label", () => {
    render(<ProgressBar value={75} label="Test Progress" />);

    expect(screen.getByLabelText("Test Progress")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
  });

  it("renders progress bar without label", () => {
    render(<ProgressBar value={50} />);

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("clamps progress value to 100 maximum", () => {
    render(<ProgressBar value={150} label="Over 100%" />);

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute("aria-valuenow", "150");
    expect(progressBar).toHaveAttribute("aria-valuemax", "100");
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("clamps progress value to 0 minimum", () => {
    render(<ProgressBar value={-50} label="Negative Value" />);

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute("aria-valuenow", "-50");
    expect(progressBar).toHaveAttribute("aria-valuemin", "0");
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("uses default max value of 100", () => {
    render(<ProgressBar value={75} label="Default Max" />);

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute("aria-valuemax", "100");
  });

  it("applies correct width style based on percentage", () => {
    render(<ProgressBar value={25} label="25 Percent" />);

    const fillElement = screen.getByRole("progressbar").firstChild;
    expect(fillElement).toHaveStyle({ width: "25%" });
  });

  it("renders with zero value", () => {
    render(<ProgressBar value={0} label="Zero Progress" />);

    expect(screen.getByText("0%")).toBeInTheDocument();
    const fillElement = screen.getByRole("progressbar").firstChild;
    expect(fillElement).toHaveStyle({ width: "0%" });
  });

  it("renders with maximum value", () => {
    render(<ProgressBar value={100} label="Complete" />);

    expect(screen.getByText("100%")).toBeInTheDocument();
    const fillElement = screen.getByRole("progressbar").firstChild;
    expect(fillElement).toHaveStyle({ width: "100%" });
  });

  it("has proper accessibility attributes", () => {
    render(<ProgressBar value={60} label="Accessible Progress" />);

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute("aria-valuenow", "60");
    expect(progressBar).toHaveAttribute("aria-valuemax", "100");
    expect(progressBar).toHaveAttribute("aria-valuemin", "0");
    expect(progressBar).toHaveAttribute("aria-label", "Accessible Progress");
  });
});
