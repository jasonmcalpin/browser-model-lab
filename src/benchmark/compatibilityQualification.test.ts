import { describe, expect, it } from "vitest";
import { checkAdapterConformance } from "./adapterConformance";
import { testCandidateById } from "./testCandidates";
import { qualifyCompatibility, qualityScoringAllowed } from "./compatibilityQualification";

describe("browser AI compatibility qualification", () => {
  it("classifies native, prompted, and unknown tool contracts without conflating them", () => {
    const native = testCandidateById("qwen3-0.6b-q4f16-control");
    const prompted = testCandidateById("deepseek-r1-distill-qwen-1.5b-q4f16");
    const unknown = testCandidateById("llama32-1b-instruct-q4f16");

    const nativeQ = qualifyCompatibility({ candidate: native, adapterConformance: checkAdapterConformance(native),
      initializationAttempted: true, initialized: true });
    const promptedQ = qualifyCompatibility({ candidate: prompted, adapterConformance: checkAdapterConformance(prompted),
      initializationAttempted: true, initialized: true });
    const unknownQ = qualifyCompatibility({ candidate: unknown, adapterConformance: checkAdapterConformance(unknown),
      initializationAttempted: true, initialized: true });

    expect(nativeQ.state).toBe("COMPATIBLE");
    expect(promptedQ.state).toBe("COMPATIBLE_WITH_PROMPTED_TOOLS");
    expect(unknownQ.state).toBe("NO_NATIVE_TOOL_CONTRACT");
    expect([nativeQ, promptedQ, unknownQ].every(qualityScoringAllowed)).toBe(true);
  });

  it("keeps runtime blockage and adapter invalidity out of quality scoring", () => {
    const model = testCandidateById("qwen3-1.7b-q4f16");
    const conformance = checkAdapterConformance(model);
    const blocked = qualifyCompatibility({ candidate: model, adapterConformance: conformance,
      initializationAttempted: true, initialized: false, initializationError: "std::bad_alloc" });
    expect(blocked.state).toBe("RUNTIME_BLOCKED");
    expect(qualityScoringAllowed(blocked)).toBe(false);

    const invalid = qualifyCompatibility({ candidate: model,
      adapterConformance: { passed: false, checks: [{ id: "tool-call-normalization", passed: false, evidence: "bad" }] },
      initializationAttempted: false, initialized: false });
    expect(invalid.state).toBe("INVALID_INTEGRATION");
    expect(qualityScoringAllowed(invalid)).toBe(false);
  });
});
