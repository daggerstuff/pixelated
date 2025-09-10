import { render, screen } from "@testing-library/react";
import { TherapistDashboard } from "../TherapistDashboard";
import type { TherapistSession } from "@/types/dashboard";
import { describe, expect, it } from "vitest";

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
});
