import { describe, expect, it } from "vitest";
import { buildCandidateDiagnostics } from "./diagnostics";

describe("browser AI role diagnostics", () => {
  it("classifies role evidence and explains partial tool trajectories", () => {
    const input = {
      productionFitness: {
        score: 90, maximum: 120,
        cases: [
          { id: "PF2", passed: true }, { id: "PF6", passed: true }, { id: "PF7", passed: true },
          { id: "PF8", passed: true }, { id: "PF9A", passed: true }, { id: "PF9B", passed: true },
          { id: "PF10", passed: true }, { id: "PF11", passed: false, evidence: "overwrite accepted" },
          { id: "PF4", passed: true },
        ],
      },
      efficiencyProbe: { budgets: {
        "256": [
          { policy: "baseline", passed: true, generatedTokens: 22 },
          { policy: "bounded", passed: true, generatedTokens: 18 },
        ],
      } },
      diagnosticProbes: { cases: [
        { id: "IC1", passed: true }, { id: "T3", passed: true }, { id: "T4", passed: true },
        { id: "T5", passed: true }, { id: "T6", passed: true }, { id: "A1", passed: true },
        { id: "A2", passed: false, reasons: ["recovery"], evidence: "repeated failed call" },
        { id: "A3", passed: true }, { id: "P1", passed: true },
      ] },
      advancedAgent: {
        g1: { status: "complete", passed: true },
        budgets: {
          "256": {
            status: "complete",
            gates: { g2: { passed: true }, g3: { passed: true } },
            t1: { passed: false, calls: [{ tool: "inspect_relay", args: { id: "R-17" } }] },
            t2: { passed: false, calls: [{ tool: "wikipedia_search", args: { query: "Kant" } }] },
            qualityScore: 70,
            scores: [
              { id: "B1", score: 5, maximum: 5 }, { id: "B2", score: 10, maximum: 10 },
              { id: "B3", score: 15, maximum: 15 }, { id: "B4", score: 4, maximum: 20 },
              { id: "B5", score: 15, maximum: 15 }, { id: "B6", score: 10, maximum: 10 },
              { id: "B7", score: 11, maximum: 15 }, { id: "B8", score: 10, maximum: 10 },
            ],
          },
        },
      },
    } as unknown as Parameters<typeof buildCandidateDiagnostics>[0];

    const diagnostics = buildCandidateDiagnostics(input);
    expect(diagnostics.roles.find((role) => role.id === "scene-roleplay")?.rating).toBe("STRONG");
    expect(diagnostics.roles.find((role) => role.id === "evidence-security")?.rating).toBe("STRONG");
    expect(diagnostics.failures).toEqual(expect.arrayContaining([
      expect.objectContaining({ caseId: "256:T1", reasons: expect.arrayContaining(["failed-to-stop"]) }),
      expect.objectContaining({ caseId: "A2", reasons: ["recovery"] }),
      expect.objectContaining({ caseId: "PF11", reasons: expect.arrayContaining(["identity-drift"]) }),
    ]));
  });
});
