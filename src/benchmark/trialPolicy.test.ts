import { describe, expect, it } from "vitest";
import { candidateById } from "./candidates";
import { buildTrialSummary, resultValidity, trialAttempt, trialCountFor } from "./trialPolicy";
import type { GenerationResult } from "./types";

const generation = (tokens: number, termination: GenerationResult["metrics"]["termination"] = "EOS"):
GenerationResult => ({ raw: `raw-${tokens}`, final: `final-${tokens}`, metrics: {
  generatedTokens: tokens, firstTokenMs: tokens, generationMs: tokens * 2,
  tokensPerSecond: 1, termination,
} });

describe("browser AI sampled-trial policy", () => {
  it("derives trial count from the selected compatibility workload profile", () => {
    const qwen = candidateById("qwen3-0.6b-q4f16-control");
    const deepseek = candidateById("deepseek-r1-distill-qwen-1.5b-q4f16");
    expect(trialCountFor(qwen, "direct")).toBe(3);
    expect(trialCountFor(qwen, "production")).toBe(3);
    expect(trialCountFor(qwen, "tool")).toBe(3);
    expect(trialCountFor(deepseek, "production")).toBe(3);
  });

  it("retains raw attempts and reports median, range, pass count, and token constraint", () => {
    const attempts = [
      trialAttempt(1, true, 10, [generation(10)], 100),
      trialAttempt(2, false, 0, [generation(30, "TOKEN_LIMIT")], 300),
      trialAttempt(3, true, 10, [generation(20)], 200),
    ];
    expect(buildTrialSummary(attempts)).toMatchObject({ attemptCount: 3, passCount: 2,
      medianScore: 10, minimumScore: 0, maximumScore: 10, medianGeneratedTokens: 20,
      medianTtftMs: 20, medianModelMs: 40, medianEndToEndMs: 200,
      attempts: [{ rawOutputs: ["raw-10"] }, { validity: "CONSTRAINED" }, { rawOutputs: ["raw-20"] }],
    });
    expect(resultValidity([generation(30, "TOKEN_LIMIT")], false)).toBe("CONSTRAINED");
    expect(resultValidity([generation(10)], false, false)).toBe("INVALID_INTEGRATION");
  });
});
