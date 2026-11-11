import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BROWSER_AI_BENCHMARK_CANDIDATES } from "./candidates";

const root = fileURLToPath(new URL(".", import.meta.url));
const productionRoot = fileURLToPath(new URL("../browser-ai-runtime/", import.meta.url));

describe("browser AI benchmark V2 architecture", () => {
  it("keeps benchmark authority outside domain, persistence, progression, and production selection", () => {
    const sources = ["benchmarkRunner.ts", "productionFitness.ts", "toolHarness.ts", "scoring.ts", "benchmark.worker.ts",
      "compatibilityProfiles.ts", "compatibilityQualification.ts", "modelRuntime.ts", "modelAdapters.ts", "adapterConformance.ts", "trialPolicy.ts", "operatingEnvelope.ts",
      "webGpuCapabilities.ts", "automation.ts", "artifact.ts"]
      .map((file) => readFileSync(`${root}/${file}`, "utf8")).join("\n");
    expect(sources).not.toMatch(/@code-gauntlet\/(engine|missions|persistence|runner)/);
    const productionContracts = readFileSync(`${productionRoot}/contracts.ts`, "utf8");
    expect(productionContracts).toContain('model: "onnx-community/Qwen3-0.6B-ONNX"');
    expect(productionContracts).not.toContain("DeepSeek-R1-Distill");
    expect(productionContracts).not.toContain("SmolLM2");
    const main = readFileSync(fileURLToPath(new URL("../../main.tsx", import.meta.url)), "utf8");
    expect(main).toContain('import.meta.env.DEV && new URLSearchParams(window.location.search).get("browser-ai-benchmark") === "1"');
  });

  it("registers the shootout behind one compatibility-aware descriptor shape", () => {
    expect(BROWSER_AI_BENCHMARK_CANDIDATES).toHaveLength(13);
    expect(BROWSER_AI_BENCHMARK_CANDIDATES[0]?.id).toBe("qwen3-0.6b-q4f16-control");
    expect(BROWSER_AI_BENCHMARK_CANDIDATES.every((candidate) => candidate.backend === "webgpu"
      && candidate.structuredOutput === "json-fallback"
      && Boolean(candidate.compatibilityProfileId))).toBe(true);
    expect(BROWSER_AI_BENCHMARK_CANDIDATES.some((candidate) => candidate.pipelineTask === "direct-model")).toBe(true);
    expect(BROWSER_AI_BENCHMARK_CANDIDATES.some((candidate) => candidate.dtype === "mixed")).toBe(true);
  });

  it("permits the accepted 768-token ceiling only in the development Worker", () => {
    const worker = readFileSync(`${root}/benchmark.worker.ts`, "utf8");
    expect(worker).toContain("invocation.settings.maxNewTokens > 768");
    const productionWorker = readFileSync(`${productionRoot}/browserAi.worker.ts`, "utf8");
    expect(productionWorker).not.toContain("max_new_tokens: 768");
  });
});
