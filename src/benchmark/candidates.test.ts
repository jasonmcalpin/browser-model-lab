import { describe, expect, it } from "vitest";
import { BROWSER_AI_BENCHMARK_CANDIDATES, validateCandidateRegistry } from "./candidates";

describe("browser AI benchmark candidate adapters", () => {
  it("keeps the shootout registry open-ended and records candidate runtime profiles", () => {
    expect(BROWSER_AI_BENCHMARK_CANDIDATES).toHaveLength(13);
    expect(BROWSER_AI_BENCHMARK_CANDIDATES.some((candidate) => candidate.dtype === "q4")).toBe(true);
    expect(BROWSER_AI_BENCHMARK_CANDIDATES.some((candidate) => candidate.pipelineTask === "direct-model")).toBe(true);
    expect(BROWSER_AI_BENCHMARK_CANDIDATES.map((candidate) => candidate.id)).toContain("qwen35-2b-q4f16");
    expect(BROWSER_AI_BENCHMARK_CANDIDATES.map((candidate) => candidate.id)).toContain("qwen35-0.8b-multimodal");
    expect(BROWSER_AI_BENCHMARK_CANDIDATES.every((candidate) => Boolean(candidate.compatibilityProfileId))).toBe(true);
  });

  it("rejects duplicate descriptors without changing benchmark cases", () => {
    expect(() => validateCandidateRegistry([
      BROWSER_AI_BENCHMARK_CANDIDATES[0]!,
      BROWSER_AI_BENCHMARK_CANDIDATES[0]!,
    ])).toThrow(/Duplicate/);
  });
});
