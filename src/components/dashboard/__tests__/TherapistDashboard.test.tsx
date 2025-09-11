import { render, screen, fireEvent } from "@testing-library/react";
import { TherapistDashboard } from "../TherapistDashboard";
import type { TherapistSession } from "@/types/dashboard";
import { describe, expect, it, vi } from "vitest";

// Mock child components
vi.mock("../AnalyticsCharts", () => ({
  AnalyticsCharts: () => <div data-testid="analytics-charts">Analytics Charts</div>
}));

vi.mock("../SessionControls", () => ({
  SessionControls: () => <div data-testid="session-controls">Session Controls</div>
}));

vi.mock("../TherapistProgressTracker", () => ({
  TherapistProgressTracker: () => <div data-testid="progress-tracker">Progress Tracker</div>
}));

vi.mock("../TherapyProgressCharts", () => ({
  TherapyProgressCharts: () => <div data-testid="therapy-charts">Therapy Charts</div>
}));

describe("TherapistDashboard", () => {
  it("renders dashboard heading", () => {
    const mockSessions: TherapistSession[] = [
      {
        id: 'session-1',
        status: 'completed',
        startTime: new Date('2025-01-01T10:00:00Z'),
        endTime: new Date('2025-01-01T11:00:00Z'),
      }
    ];

    render(<TherapistDashboard sessions={mockSessions} />);
    expect(screen.getByLabelText('Therapist Dashboard')).toBeInTheDocument();
  });

  it("renders with empty sessions array", () => {
    render(<TherapistDashboard sessions={[]} onSessionControl={mockOnSessionControl} />);

    expect(screen.getByLabelText('Therapist Dashboard')).toBeInTheDocument();
    expect(screen.getByLabelText('Session Controls')).toBeInTheDocument();
  });
});
