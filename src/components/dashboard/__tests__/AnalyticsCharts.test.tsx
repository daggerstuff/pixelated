import { render, screen } from "@testing-library/react";
import { AnalyticsCharts } from "../AnalyticsCharts";

describe("AnalyticsCharts", () => {
  it("renders analytics charts heading", () => {
    render(<AnalyticsCharts />);
    expect(screen.getByText(/Analytics Charts/i)).toBeInTheDocument();
  });
});
