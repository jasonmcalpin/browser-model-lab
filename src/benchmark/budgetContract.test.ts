import { describe, expect, it } from "vitest";
import { BENCHMARK_REASONING_BUDGETS, G1_MAX_NEW_TOKENS, runIndependentBudgetMatrix,
  summarizeTaskMetrics } from "./benchmarkRunner";
import { PRODUCTION_FITNESS_MAX_NEW_TOKENS } from "./productionFitness";
import type { GenerationResult } from "./types";

const generation = (generatedTokens: number, firstTokenMs: number, generationMs: number): GenerationResult => ({
  raw: "raw", final: "final", metrics: { generatedTokens, firstTokenMs, generationMs,
    tokensPerSecond: generatedTokens / (generationMs / 1000), termination: "EOS" },
});

describe("browser AI token-budget contract", () => {
  it("keeps G1 at 16 and runs the reasoning matrix at 256, 512, and 768", () => {
    expect(G1_MAX_NEW_TOKENS).toBe(16);
    expect(PRODUCTION_FITNESS_MAX_NEW_TOKENS).toBe(256);
    expect(BENCHMARK_REASONING_BUDGETS).toEqual([256, 512, 768]);
  });

  it("continues through later budgets when an earlier run fails", async () => {
    const attempted: number[] = [];
    const results = await runIndependentBudgetMatrix(async (budget) => {
      attempted.push(budget);
      if (budget === 256) throw new Error("budget exhausted");
      return `pass-${budget}`;
    }, (budget) => `failed-${budget}`);
    expect(attempted).toEqual([256, 512, 768]);
    expect(results).toEqual({ "256": "failed-256", "512": "pass-512", "768": "pass-768" });
  });

  it("records cumulative token milestones and timing without inference", () => {
    expect(summarizeTaskMetrics([generation(120, 30, 500), generation(200, 40, 800)], 12, 1330, 120, 320))
      .toEqual({ reachedValidToolCall: true, reachedFinalAnswer: true, tokensToFirstValidToolCall: 120,
        tokensToFinalAnswer: 320, totalGeneratedTokens: 320, ttftMs: 30, modelMs: 1300,
        toolMs: 12, endToEndMs: 1330 });
  });
});
