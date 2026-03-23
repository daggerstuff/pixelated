import { describe, expect, it, vi } from "vitest";
import { UnifiedMonitor } from "../unified-monitor";

describe("UnifiedMonitor", () => {
  it("aggregates events from all modules (fhe, audit, secrets, governance)", () => {
    const monitor = new UnifiedMonitor();

    // Record events from different sources
    monitor.record({ source: "fhe", type: "encryption", status: "success" });
    monitor.record({ source: "audit", type: "log", status: "success" });
    monitor.record({ source: "secrets", type: "rotation", status: "success" });
    monitor.record({ source: "governance", type: "policy_check", status: "success" });

    // Verify events are aggregated by source
    const fheEvents = monitor.getEvents("fhe");
    const auditEvents = monitor.getEvents("audit");
    const secretsEvents = monitor.getEvents("secrets");
    const governanceEvents = monitor.getEvents("governance");

    expect(fheEvents).toHaveLength(1);
    expect(fheEvents[0]).toEqual(
      expect.objectContaining({
        source: "fhe",
        type: "encryption",
        status: "success",
      }),
    );

    expect(auditEvents).toHaveLength(1);
    expect(secretsEvents).toHaveLength(1);
    expect(governanceEvents).toHaveLength(1);
  });

  it("triggers alert on threshold breach (5+ compliance failures)", () => {
    const monitor = new UnifiedMonitor();
    const alertHandler = vi.fn();
    monitor.onAlert(alertHandler);

    // Record 4 failures - should NOT trigger alert
    for (let i = 0; i < 4; i++) {
      monitor.record({ source: "governance", type: "compliance_failure", status: "failure" });
    }
    expect(alertHandler).not.toHaveBeenCalled();

    // Record 5th failure - SHOULD trigger alert
    monitor.record({ source: "governance", type: "compliance_failure", status: "failure" });
    expect(alertHandler).toHaveBeenCalledTimes(1);
    expect(alertHandler).toHaveBeenCalledWith({
      source: "governance",
      type: "compliance_failure",
      count: 5,
      threshold: 5,
    });
  });
});
