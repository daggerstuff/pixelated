import { render, screen } from "@testing-library/react";
import { TherapistDashboard } from "../TherapistDashboard";
import { describe, it, expect, vi } from "vitest";

// Local minimal type to avoid relying on path aliases in tests
interface TherapistSession {
  id: string;
  clientId: string;
  therapistId: string;
  status: string;
  progress: number;
}

describe("Dashboard Performance Tests", () => {
  it("renders therapist dashboard", () => {
    const mockSessions: TherapistSession[] = [
      // minimal mock - cast to satisfy the shape in tests without relying on full implementation
      { id: "s1", clientId: "c1", therapistId: "t1", status: "completed", progress: 100 },
    ];
    const mockOnSessionControl = vi.fn();
    render(<TherapistDashboard sessions={mockSessions} onSessionControl={mockOnSessionControl} />);
    expect(screen.getByLabelText("Therapist Dashboard")).toBeInTheDocument();
  });
});
