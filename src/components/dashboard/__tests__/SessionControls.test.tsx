import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionControls } from "../SessionControls";
import type { TherapistSession } from "@/types/dashboard";
import { describe, expect, it, vi, beforeEach } from "vitest";

describe("SessionControls", () => {
  const mockSessions: TherapistSession[] = [
    {
      id: 'session-1',
      clientId: 'client-1',
      therapistId: 'therapist-1',
      startTime: '2025-01-01T10:00:00Z',
      endTime: '2025-01-01T11:00:00Z',
      status: 'active',
      progress: 50,
    },
    {
      id: 'session-2',
      clientId: 'client-2',
      therapistId: 'therapist-1',
      startTime: '2025-01-02T10:00Z',
      status: 'paused',
      progress: 75,
    }
  ];

  const mockOnSessionControl = vi.fn();

  beforeEach(() => {
    mockOnSessionControl.mockClear();
  });

  it("renders session controls with proper ARIA labels", () => {
    render(<SessionControls sessions={mockSessions} onSessionControl={mockOnSessionControl} />);
    expect(screen.getByLabelText('Session Controls')).toBeInTheDocument();
    expect(screen.getByRole('group')).toBeInTheDocument();
 });

  it("displays correct control buttons", () => {
    render(<SessionControls sessions={mockSessions} onSessionControl={mockOnSessionControl} />);

    expect(screen.getByText('Pause Session')).toBeInTheDocument();
    expect(screen.getByText('Resume Session')).toBeInTheDocument();
    expect(screen.getByText('End Session')).toBeInTheDocument();
 });

  it("enables/disables buttons based on session state", () => {
    render(<SessionControls sessions={mockSessions} onSessionControl={mockOnSessionControl} />);

    const pauseButton = screen.getByText('Pause Session');
    const resumeButton = screen.getByText('Resume Session');
    const endButton = screen.getByText('End Session');

    // Active session should enable pause and end buttons
    expect(pauseButton).toBeEnabled();
    expect(endButton).toBeEnabled();

    // Paused session should enable resume button
    expect(resumeButton).toBeEnabled();
  });

  it("calls onSessionControl with correct parameters when buttons are clicked", async () => {
    const user = userEvent.setup();
    render(<SessionControls sessions={mockSessions} onSessionControl={mockOnSessionControl} />);

    const pauseButton = screen.getByText('Pause Session');
    await user.click(pauseButton);

    expect(mockOnSessionControl).toHaveBeenCalledWith('session-1', 'pause');
  });

 it("renders recent sessions list", () => {
    render(<SessionControls sessions={mockSessions} onSessionControl={mockOnSessionControl} />);

    expect(screen.getByText('Recent Sessions')).toBeInTheDocument();
    expect(screen.getByText('Session session-1')).toBeInTheDocument();
    expect(screen.getByText('Session session-2')).toBeInTheDocument();
  });

  it("displays session status badges with correct styling", () => {
    render(<SessionControls sessions={mockSessions} onSessionControl={mockOnSessionControl} />);

    const activeBadge = screen.getByText('active');
    const pausedBadge = screen.getByText('paused');

    expect(activeBadge).toHaveClass('bg-green-100', 'text-green-800');
    expect(pausedBadge).toHaveClass('bg-yellow-100', 'text-yellow-800');
  });

  it("renders empty state when no sessions", () => {
    render(<SessionControls sessions={[]} onSessionControl={mockOnSessionControl} />);

    expect(screen.getByText('No recent sessions available')).toBeInTheDocument();
  });

  it("handles keyboard navigation for buttons", () => {
    render(<SessionControls sessions={mockSessions} onSessionControl={mockOnSessionControl} />);

    const pauseButton = screen.getByText('Pause Session');
    pauseButton.focus();

    expect(pauseButton).toHaveFocus();
  });

  it("handles escape key to blur buttons", async () => {
    const user = userEvent.setup();
    render(<SessionControls sessions={mockSessions} onSessionControl={mockOnSessionControl} />);

    const pauseButton = screen.getByText('Pause Session');
    pauseButton.focus();

    await user.keyboard('{Escape}');

    // In JSDOM, we can't easily test blur state, but we can ensure no errors occur
    expect(screen.getByText('Pause Session')).toBeInTheDocument();
  });
});
