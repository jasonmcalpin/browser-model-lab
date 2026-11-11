import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BROWSER_AI_BENCHMARK_CANDIDATES, DEFAULT_BROWSER_AI_CANDIDATE_ID } from "./candidates";

const root = fileURLToPath(new URL(".", import.meta.url));

describe("Browser Model Lab architecture", () => {
  it("keeps the standalone benchmark independent from consumer application packages", () => {
    const sources = [
      "benchmarkRunner.ts", "productionFitness.ts", "toolHarness.ts", "scoring.ts", "benchmark.worker.ts",
      "compatibilityProfiles.ts", "compatibilityQualification.ts", "modelRuntime.ts", "modelAdapters.ts",
      "adapterConformance.ts", "trialPolicy.ts", "operatingEnvelope.ts", "webGpuCapabilities.ts",
      "automation.ts", "artifact.ts", "diagnosticProbes.ts", "diagnostics.ts",
    ].map((file) => readFileSync(`${root}/${file}`, "utf8")).join("\n");
    expect(sources).not.toMatch(/@code-gauntlet\//);
    expect(sources).not.toMatch(/pantheon/i);

    const main = readFileSync(fileURLToPath(new URL("../main.tsx", import.meta.url)), "utf8");
    expect(main).toContain('import { BrowserAiBenchmark } from "./benchmark"');
  });

  it("discovers active model cards behind one compatibility-aware descriptor shape", () => {
    expect(BROWSER_AI_BENCHMARK_CANDIDATES.length).toBeGreaterThan(0);
    expect(BROWSER_AI_BENCHMARK_CANDIDATES.map((candidate) => candidate.id)).toContain(DEFAULT_BROWSER_AI_CANDIDATE_ID);
    expect(BROWSER_AI_BENCHMARK_CANDIDATES.every((candidate) => candidate.backend === "webgpu"
      && candidate.structuredOutput === "json-fallback"
      && Boolean(candidate.compatibilityProfileId))).toBe(true);
    expect(BROWSER_AI_BENCHMARK_CANDIDATES.some((candidate) => candidate.dtype === "q4")).toBe(true);
    expect(BROWSER_AI_BENCHMARK_CANDIDATES.some((candidate) => candidate.dtype === "q4f16")).toBe(true);
  });

  it("keeps the accepted 768-token ceiling in the isolated benchmark worker", () => {
    const worker = readFileSync(`${root}/benchmark.worker.ts`, "utf8");
    expect(worker).toContain("invocation.settings.maxNewTokens > 768");
  });
});
