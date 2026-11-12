import { buildEvalManifest } from "./evalManifest";
import { BENCHMARK_REASONING_BUDGETS, G1_MAX_NEW_TOKENS } from "./benchmarkRunner";
import { PRODUCTION_FITNESS_MAX_NEW_TOKENS } from "./productionFitness";
import type { BenchmarkReasoningBudget, BrowserAiBenchmarkArtifact, CandidateBenchmarkResult,
  LiveWikipediaSmokeResult, WebGpuCapabilities } from "./types";

export function buildBrowserAiBenchmarkArtifact(results: readonly CandidateBenchmarkResult[],
  webGpuCapabilities?: WebGpuCapabilities, liveWikipediaSmoke?: LiveWikipediaSmokeResult,
  reasoningBudgets: readonly BenchmarkReasoningBudget[] = BENCHMARK_REASONING_BUDGETS,
  metadata: { readonly machine: string; readonly benchmarkRevision: string; readonly selectedTests?: readonly string[];
    readonly environment?: { readonly userAgent: string; readonly webgpu: boolean } } = {
    machine: "unlabeled", benchmarkRevision: "uncommitted-browser-session",
  }): BrowserAiBenchmarkArtifact {
  const detectedEnvironment = metadata.environment ?? {
    userAgent: globalThis.navigator?.userAgent ?? "unknown",
    webgpu: Boolean(globalThis.navigator && "gpu" in globalThis.navigator),
  };
  return {
    schemaVersion: 13,
    manifest: buildEvalManifest({
      benchmarkRevision: metadata.benchmarkRevision,
      candidateIds: results.map((result) => result.candidateId),
      selectedTests: metadata.selectedTests ?? ["all"],
      reasoningBudgets,
    }),
    suite: "browser-ai-benchmark-v2",
    benchmarkRevision: metadata.benchmarkRevision,
    machine: metadata.machine,
    generatedAt: new Date().toISOString(),
    environment: { ...detectedEnvironment, transformersJs: "4.3.2" },
    settings: {
      backend: "webgpu",
      dtype: "candidate-defined",
      generationPolicy: "candidate-adapter",
      maxContextTokens: 4096,
      g1MaxNewTokens: G1_MAX_NEW_TOKENS,
      productionFitnessMaxNewTokens: PRODUCTION_FITNESS_MAX_NEW_TOKENS,
      reasoningBudgets,
    },
    ...(webGpuCapabilities ? { webGpuCapabilities } : {}),
    candidates: results,
    ...(liveWikipediaSmoke ? { liveWikipediaSmoke } : {}),
  };
}
