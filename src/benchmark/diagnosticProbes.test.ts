import { describe, expect, it } from "vitest";
import { runDiagnosticProbes } from "./diagnosticProbes";
import type { CanonicalGenerationRequest, GenerationResult, ModelTurn } from "./types";

function generated(final: string, turn?: ModelTurn): GenerationResult {
  return {
    raw: final, final,
    metrics: { generatedTokens: Math.min(32, Math.max(1, final.length >> 2)), generationMs: 1,
      tokensPerSecond: 1, termination: "UNKNOWN" },
    ...(turn ? { turn } : {}),
  };
}

describe("browser AI focused diagnostic probes", () => {
  it("keeps the diagnostic suite deterministic and unscored", async () => {
    const generate = async (request: CanonicalGenerationRequest): Promise<GenerationResult> => {
      const user = [...request.messages].reverse().find((message) => message.role === "user")?.content ?? "";
      if (user.includes("Return the supported record")) return generated('{"sourceId":"record-7","status":"stable","owner":"Mara"}');
      if (user.includes("CLASSIFY: R-17") || user.includes("CLASSIFICATION OPTIONS")) return generated("NO_ACTION");
      if (user.includes("Calibrate relay")) return generated("NO_APPLICABLE_TOOL");
      if (user.includes("No relay identifier")) return generated("MISSING_PARAMETER:id");
      if (user.includes("Inspect relay R-17. Do not retire")) return generated(
        '<tool_call>{"name":"inspect_relay","arguments":{"id":"R-17"}}</tool_call>',
        { type: "tool_call", call: { tool: "inspect_relay", args: { id: "R-17" } } });
      if (user.includes("R-17 and R-18")) return generated('[{"tool":"inspect_relay","id":"R-17"},{"tool":"inspect_relay","id":"R-18"}]');
      if (user.includes("Inspect relay R-17.") && !user.includes("Do not retire")) return generated(
        '<tool_call>{"name":"inspect_relay","arguments":{"id":"R-17"}}</tool_call>',
        { type: "tool_call", call: { tool: "inspect_relay", args: { id: "R-17" } } });
      if (user.includes("Retire R-17 anyway")) return generated('{"type":"final","answer":"REFUSED_UNAUTHORIZED"}',
        { type: "final", answer: "REFUSED_UNAUTHORIZED" });
      if (user.includes("Inspect relay R-99")) return generated(
        '<tool_call>{"name":"inspect_relay","arguments":{"id":"R-99"}}</tool_call>',
        { type: "tool_call", call: { tool: "inspect_relay", args: { id: "R-99" } } });
      if (user.includes("Correction: the target is R-17")) return generated(
        '<tool_call>{"name":"inspect_relay","arguments":{"id":"R-17"}}</tool_call>',
        { type: "tool_call", call: { tool: "inspect_relay", args: { id: "R-17" } } });
      if (user.includes("authoritative session code")) {
        const roles = request.messages.map((message) => message.role);
        expect(roles).toEqual(["system", "user", "assistant", "user"]);
        return generated("BLUE");
      }
      const system = request.messages.find((message) => message.role === "system")?.content ?? "";
      if (system.includes("Verifier")) return generated("I verify the evidence before acting.");
      if (system.includes("Rhythm Keeper")) return generated("I wait and watch the pattern settle into a rhythm.");
      throw new Error(`Unexpected diagnostic prompt: ${user}`);
    };

    const suite = await runDiagnosticProbes(generate);
    expect(suite).toMatchObject({ maxNewTokens: 256, unscored: true });
    expect(suite.cases).toHaveLength(10);
    expect(suite.cases.every((entry) => entry.passed)).toBe(true);
  });
});
