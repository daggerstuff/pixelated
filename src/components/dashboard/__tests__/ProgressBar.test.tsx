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

    expect(screen.getByRole("progressbar", { name: "Progress Bar" })).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("clamps progress value to 100 maximum", () => {
    render(<ProgressBar value={150} label="Over 100%" />);

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute("aria-valuenow", "100");
    expect(progressBar).toHaveAttribute("aria-valuemax", "100");
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("clamps progress value to 0 minimum", () => {
    render(<ProgressBar value={-50} label="Negative Value" />);

    const progressBar = screen.getByRole("progressbar");
    // The component clamps negative values to the minimum (0).
    expect(progressBar).toHaveAttribute("aria-valuenow", "0");
    expect(progressBar).toHaveAttribute("aria-valuemin", "0");
    // Visible label should show the clamped value
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("uses default max value of 100", () => {
    render(<ProgressBar value={75} label="Default Max" />);

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute("aria-valuemax", "100");
  });

  it("applies correct width style based on percentage", () => {
    render(<ProgressBar value={25} label="25 Percent" />);

    const progressBar = screen.getByRole("progressbar");
    const fillElement = progressBar.querySelector('.bg-primary');
    expect(fillElement).toHaveStyle({ width: "25%" });
  });

  it("renders with zero value", () => {
    render(<ProgressBar value={0} label="Zero Progress" />);

    expect(screen.getByText("0%")).toBeInTheDocument();
    const progressBar = screen.getByRole("progressbar");
    const fillElement = progressBar.querySelector('.bg-primary');
    expect(fillElement).toHaveStyle({ width: "0%" });
  });

  it("renders with maximum value", () => {
    render(<ProgressBar value={100} label="Complete" />);

    expect(screen.getByText("100%")).toBeInTheDocument();
    const progressBar = screen.getByRole("progressbar");
    const fillElement = progressBar.querySelector('.bg-primary');
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

  it("forwards aria-label prop correctly", () => {
    render(<ProgressBar value={75} aria-label="Custom Progress Label" />);

    expect(screen.getByRole("progressbar", { name: "Custom Progress Label" })).toBeInTheDocument();
  });

  it("forwards aria-labelledby prop correctly", () => {
    render(
      <>
        <span id="progress-label">External Label</span>
        <ProgressBar value={75} aria-labelledby="progress-label" />
      </>
    );

    expect(screen.getByRole("progressbar", { name: "External Label" })).toBeInTheDocument();
    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute("aria-labelledby", "progress-label");
    expect(progressBar).not.toHaveAttribute("aria-label");
  });

  it("prioritizes aria-labelledby over aria-label and label props", () => {
    render(
      <>
        <span id="priority-label">Priority Label</span>
        <ProgressBar
          value={75}
          label="Regular Label"
          aria-label="Aria Label"
          aria-labelledby="priority-label"
        />
      </>
    );

    expect(screen.getByRole("progressbar", { name: "Priority Label" })).toBeInTheDocument();
    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute("aria-labelledby", "priority-label");
    expect(progressBar).not.toHaveAttribute("aria-label");
  });

  it("prioritizes aria-label over label prop", () => {
    render(<ProgressBar value={75} label="Regular Label" aria-label="Aria Label" />);

    expect(screen.getByRole("progressbar", { name: "Aria Label" })).toBeInTheDocument();
    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute("aria-label", "Aria Label");
    expect(progressBar).not.toHaveAttribute("aria-labelledby");
  });
});
