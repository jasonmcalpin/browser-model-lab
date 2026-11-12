import { describe, expect, it, vi } from "vitest";
import { benchmarkExecutionPlan, executeBrowserAiAutomation, parseBrowserAiAutomationQuery } from "./automation";
import type { BrowserAiBenchmarkArtifact, BrowserAiBenchmarkAutomationState,
  CandidateBenchmarkResult, WebGpuCapabilities } from "./types";

const capabilities = { supported: true, secureContext: true, adapterAcquired: true, deviceAcquired: true,
  observedAt: "2026-11-10T00:00:00.000Z", adapterFeatures: [], deviceFeatures: [],
  adapterLimits: {}, deviceLimits: {} } satisfies WebGpuCapabilities;
const candidateFailure = {
  candidateId: "control", label: "control", modelId: "owner/model", revision: "main", dtype: "q4f16", pipelineTask: "text-generation",
  artifactUrls: [], adapter: { adapterId: "declarative-v1", promptPlacement: "preserve-roles",
    toolCallFormat: "tagged-json", reasoningFormat: "none",
    profiles: { production: { doSample: false }, direct: { doSample: false }, tool: { doSample: false } },
    runtimeKind: "pipeline", toolSupportMode: "native-template", compatibilityProfileId: "test-profile" },
  adapterConformance: { passed: true, checks: [] },
  compatibilityQualification: { state: "RUNTIME_BLOCKED", profileId: "test-profile", checks: [] },
  operatingEnvelope: { requirements: [], summary: { hardRequirementsMet: 0, knownHardRequirements: 0,
    recommendedValuesMet: 0, knownRecommendedValues: 0, unknownCount: 0, blockingMisses: [], degradingMisses: [] } },
  validity: "RUNTIME_BLOCKED",
  advancedAgent: { g1: { status: "not-run", passed: false, validity: "UNMEASURED" }, budgets: {} }, warmReadyRunsMs: [],
  structuredOutput: "json-fallback", failures: [{ phase: "initialization", class: "runtime",
    envelopeRequirementIds: ["model-initialization"], message: "model failed" }],
  cacheReload: "not-run",
} as CandidateBenchmarkResult;
const artifact = { schemaVersion: 13,
  manifest: { manifestVersion: 1, benchmarkRevision: "abc123", scorerRevision: "browser-ai-scorers-v2",
    compatibilitySpec: "docs/BROWSER-AI-MODEL-COMPATIBILITY-SPECS.md", candidateIds: ["control"],
    selectedTests: ["all"], reasoningBudgets: [256, 512, 768],
    trialPolicy: { deterministic: 1, sampled: 3, aggregation: "median", passPolicy: "majority" }, cases: [] },
  suite: "browser-ai-benchmark-v2",
  benchmarkRevision: "abc123", machine: "test",
  generatedAt: "2026-11-10T00:00:00.000Z",
  environment: { userAgent: "test", webgpu: true, transformersJs: "4.3.2" },
  settings: { backend: "webgpu", dtype: "candidate-defined", generationPolicy: "candidate-adapter",
    maxContextTokens: 4096, g1MaxNewTokens: 16, productionFitnessMaxNewTokens: 256,
    reasoningBudgets: [512, 768] },
  candidates: [candidateFailure] } satisfies BrowserAiBenchmarkArtifact;

describe("browser AI query automation", () => {
  it("parses candidate, test, budget, cache, machine, and live selectors", () => {
    expect(parseBrowserAiAutomationQuery(
      "?autorun=1&candidate=control&test=t2&budget=768&cached=1&machine=mac-m4&revision=abc123&live-wikipedia=1",
      ["control", "candidate"],
    )).toEqual({
      autorun: true,
      config: { candidateIds: ["control"], test: "t2", budgets: [768], cacheMode: "cached",
        machine: "mac-m4", benchmarkRevision: "abc123", liveWikipedia: true },
    });
  });

  it("expands all candidates and rejects ambiguous or invalid selections", () => {
    expect(parseBrowserAiAutomationQuery("?autorun=1&candidate=all&test=production&cold=1",
      ["control", "candidate"]).config.candidateIds).toEqual(["control", "candidate"]);
    expect(() => parseBrowserAiAutomationQuery("?candidate=missing", ["control"])).toThrow("Unknown benchmark candidate");
    expect(() => parseBrowserAiAutomationQuery("?candidate=all&live-wikipedia=1", ["control", "candidate"]))
      .toThrow("exactly one candidate");
    expect(() => parseBrowserAiAutomationQuery("?candidate=control&cold=1&cached=1", ["control"]))
      .toThrow("exactly one cache mode");
  });

  it("builds bounded execution plans without widening the selected test", () => {
    expect(benchmarkExecutionPlan({ test: "all", budgets: [512, 768] })).toEqual({
      production: true, advanced: true, t1Only: false, t2Only: false, budgets: [512, 768],
    });
    expect(benchmarkExecutionPlan({ test: "t1", budgets: [768] })).toEqual({
      production: false, advanced: false, t1Only: true, t2Only: false, budgets: [768],
    });
    expect(benchmarkExecutionPlan({ test: "production", budgets: [512] }).budgets).toEqual([]);
  });
});

describe("browser AI automation lifecycle", () => {
  const config = parseBrowserAiAutomationQuery("?autorun=1&candidate=control&cached=1",
    ["control"]).config;

  it("publishes complete artifacts even when the model result records failure", async () => {
    const states: BrowserAiBenchmarkAutomationState[] = [];
    const runCandidate = vi.fn().mockResolvedValue(candidateFailure);
    const state = await executeBrowserAiAutomation(config, {
      publish: (next) => states.push(next),
      probeWebGpu: async () => capabilities,
      runCandidate,
      runLiveWikipedia: vi.fn(),
      buildArtifact: () => artifact,
    });
    expect(runCandidate).toHaveBeenCalledWith("control", expect.any(Function), capabilities);
    expect(state.status).toBe("complete");
    expect(states.at(-1)?.status).toBe("complete");
  });

  it("publishes failed only for a harness exception", async () => {
    const states: BrowserAiBenchmarkAutomationState[] = [];
    const state = await executeBrowserAiAutomation(config, {
      publish: (next) => states.push(next),
      probeWebGpu: async () => { throw new Error("probe crashed"); },
      runCandidate: vi.fn(),
      runLiveWikipedia: vi.fn(),
      buildArtifact: () => artifact,
    });
    expect(state).toMatchObject({ status: "failed", error: "probe crashed" });
    expect(states.at(-1)?.status).toBe("failed");
  });
});

it("accepts a validated model card override for CLI-selected folders", () => {
  const card = {
    schemaVersion: 3,
    candidate: {
      id: "custom-model", label: "custom", modelId: "owner/model", revision: "main",
      backend: "webgpu", dtype: "q4", pipelineTask: "text-generation", family: "custom",
      adapterId: "declarative-v1", compatibilityProfileId: "custom-v1",
      template: { kind: "hf-chat-template" }, structuredOutput: "json-fallback",
      compatibilityProfile: {
        id: "custom-v1", family: "custom",
        runtime: { kind: "pipeline", pipelineTask: "text-generation", dtype: "q4" },
        chat: { renderer: "tokenizer-template", promptPlacement: "preserve-roles", historyReasoning: "unknown" },
        tools: { mode: "unknown", callFormat: "canonical-json", callParser: "json-or-tagged-json", tokenizerTools: false,
          definitionFormat: "openai-functions", promptedProtocol: {
            systemTemplate: "Tools: {{tools}}\\nRules: {{taskRules}}",
            toolResultTemplate: "TOOL RESULT: {{content}}"
          } },
        reasoning: { supported: false, defaultMode: "non-thinking" },
        profiles: { production: { doSample: false }, direct: { doSample: false }, tool: { doSample: false } },
        adapterId: "generic-chat"
      }
    }
  };
  const params = new URLSearchParams({
    autorun: "1", candidate: "custom-model", "model-card": JSON.stringify(card),
    test: "all", budget: "256", cache: "cached", machine: "test", revision: "abc123"
  });
  const parsed = parseBrowserAiAutomationQuery(`?${params.toString()}`);
  expect(parsed.candidateOverride?.id).toBe("custom-model");
  expect(parsed.config.candidateIds).toEqual(["custom-model"]);
});
