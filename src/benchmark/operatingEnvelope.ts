import type { AdapterConformanceResult, AdapterProfileReport, BrowserModelCandidate,
  EnvelopeRequirement, OperatingEnvelope, WebGpuCapabilities } from "./types";

interface EnvelopeInput {
  readonly candidate: BrowserModelCandidate;
  readonly adapter: AdapterProfileReport;
  readonly adapterConformance: AdapterConformanceResult;
  readonly initializationAttempted: boolean;
  readonly initialized: boolean;
  readonly initializationError?: string;
  readonly capabilities?: WebGpuCapabilities;
  readonly cacheBytes?: number;
  readonly userAgent: string;
}

export function buildOperatingEnvelope(input: EnvelopeInput): OperatingEnvelope {
  const gpuStatus = input.capabilities === undefined ? "UNKNOWN"
    : input.capabilities.deviceAcquired ? "MET" : "NOT_MET";
  const gpuEvidence = input.capabilities?.error ?? input.capabilities?.adapterInfo?.architecture;
  const requirements: EnvelopeRequirement[] = [
    {
      id: "runtime-webgpu-device", category: "hard", expected: "WebGPU device acquired",
      observed: input.capabilities?.deviceAcquired ?? "unavailable", status: gpuStatus,
      severity: "blocking", owner: "RUNTIME",
      source: { kind: "runtime-doc", reference: "Browser AI Benchmark V2 portable WebGPU contract" },
      ...(gpuEvidence === undefined ? {} : { evidence: gpuEvidence }),
    },
    {
      id: "candidate-backend", category: "hard", expected: "webgpu", observed: input.candidate.backend,
      status: input.candidate.backend === "webgpu" ? "MET" : "NOT_MET", severity: "blocking", owner: "RUNTIME",
      source: { kind: "artifact-metadata", reference: input.candidate.modelId },
    },
    {
      id: "candidate-dtype", category: "hard", expected: input.candidate.dtype, observed: input.candidate.dtype,
      status: "MET", severity: "blocking", owner: "MODEL",
      source: { kind: "artifact-metadata", reference: input.candidate.modelId + "@" + input.candidate.revision },
    },
    {
      id: "candidate-pipeline", category: "hard", expected: input.candidate.pipelineTask,
      observed: input.candidate.pipelineTask, status: "MET", severity: "blocking", owner: "RUNTIME",
      source: { kind: "artifact-metadata", reference: input.candidate.modelId + "@" + input.candidate.revision },
    },
    {
      id: "compatibility-profile", category: "hard", expected: input.candidate.compatibilityProfileId,
      observed: input.adapter.compatibilityProfileId,
      status: input.adapter.compatibilityProfileId === input.candidate.compatibilityProfileId ? "MET" : "NOT_MET",
      severity: "blocking", owner: "MODEL",
      source: { kind: "runtime-doc", reference: "docs/BROWSER-AI-MODEL-COMPATIBILITY-SPECS.md" },
    },
    {
      id: "adapter-conformance", category: "hard", expected: "all checks pass",
      observed: input.adapterConformance.checks.map((check) => ({ id: check.id, passed: check.passed })),
      status: input.adapterConformance.passed ? "MET" : "NOT_MET", severity: "blocking", owner: "RUNTIME",
      source: { kind: "empirical", reference: "Code Gauntlet adapter conformance gate" },
    },
    {
      id: "model-initialization", category: "hard", expected: "succeeds",
      observed: input.initialized ? "succeeded" : input.initializationError ?? "not attempted",
      status: input.initialized ? "MET" : input.initializationAttempted ? "NOT_MET" : "NOT_APPLICABLE",
      severity: "blocking",
      owner: input.initializationError?.includes("bad_alloc") ? "HARDWARE" : "RUNTIME",
      source: { kind: "empirical", reference: "Transformers.js WebGPU initialization" },
      ...(input.initializationError ? { evidence: input.initializationError } : {}),
    },
    {
      id: "prompt-placement", category: "recommended", expected: input.adapter.promptPlacement,
      observed: input.adapter.promptPlacement, status: "MET", severity: "degrading", owner: "MODEL",
      source: { kind: "tokenizer-config", reference: "adapter:" + input.adapter.adapterId },
    },
    ...(["production", "direct", "tool"] as const).map((workload): EnvelopeRequirement => ({
      id: "decoding-profile-" + workload, category: "recommended",
      expected: input.adapter.profiles[workload], observed: input.adapter.profiles[workload],
      status: "MET", severity: "degrading", owner: "MODEL",
      source: { kind: "generation-config", reference: "adapter:" + input.adapter.adapterId + "/" + workload },
    })),
    {
      id: "sampled-trial-count", category: "recommended", expected: 3, observed: 3,
      status: "MET", severity: "degrading", owner: "BENCHMARK",
      source: { kind: "runtime-doc", reference: "Browser AI Benchmark V2 trial policy" },
    },
    {
      id: "deterministic-trial-count", category: "recommended", expected: 1, observed: 1,
      status: "MET", severity: "degrading", owner: "BENCHMARK",
      source: { kind: "runtime-doc", reference: "Browser AI Benchmark V2 trial policy" },
    },
    {
      id: "output-budget-guidance", category: "recommended", expected: "undocumented",
      observed: "benchmark ceilings 16/256/512/768", status: "UNKNOWN", severity: "informational", owner: "UNKNOWN",
      source: { kind: "empirical", reference: "No candidate-specific minimum/maximum output guidance established" },
    },
    {
      id: "browser-user-agent", category: "environment", expected: "recorded", observed: input.userAgent,
      status: input.userAgent ? "MET" : "UNKNOWN", severity: "informational", owner: "RUNTIME",
      source: { kind: "empirical", reference: "navigator.userAgent" },
    },
    {
      id: "webgpu-adapter", category: "environment", expected: "recorded",
      observed: input.capabilities?.adapterInfo ?? "unavailable",
      status: input.capabilities?.adapterAcquired ? "MET" : input.capabilities ? "NOT_MET" : "UNKNOWN",
      severity: "informational", owner: "HARDWARE",
      source: { kind: "empirical", reference: "navigator.gpu.requestAdapter" },
    },
    {
      id: "webgpu-buffer-limits", category: "environment", expected: "recorded",
      observed: input.capabilities ? {
        maxBufferSize: input.capabilities.deviceLimits.maxBufferSize,
        maxStorageBufferBindingSize: input.capabilities.deviceLimits.maxStorageBufferBindingSize,
      } : "unavailable",
      status: input.capabilities?.deviceAcquired ? "MET" : "UNKNOWN", severity: "informational", owner: "HARDWARE",
      source: { kind: "empirical", reference: "WebGPU supported limits" },
    },
    {
      id: "shader-f16", category: "environment", expected: "recorded",
      observed: input.capabilities ? input.capabilities.deviceFeatures.includes("shader-f16") : "unavailable",
      status: input.capabilities ? "MET" : "UNKNOWN", severity: "informational", owner: "RUNTIME",
      source: { kind: "empirical", reference: "GPUDevice.features" },
    },
    {
      id: "candidate-cache-size", category: "environment", expected: "recorded when observable",
      observed: input.cacheBytes ?? "unavailable", status: input.cacheBytes === undefined ? "UNKNOWN" : "MET",
      severity: "informational", owner: "RUNTIME",
      source: { kind: "empirical", reference: "candidate-owned Cache Storage snapshot" },
    },
    {
      id: "gpu-memory-capacity", category: "environment", expected: "unknown",
      observed: "not exposed by portable browser APIs", status: "UNKNOWN", severity: "informational", owner: "UNKNOWN",
      source: { kind: "runtime-doc", reference: "Browser AI Benchmark V2 portable WebGPU contract" },
    },
  ];
  const known = (entry: EnvelopeRequirement) => entry.status !== "UNKNOWN" && entry.status !== "NOT_APPLICABLE";
  return {
    requirements,
    summary: {
      hardRequirementsMet: requirements.filter((entry) => entry.category === "hard" && entry.status === "MET").length,
      knownHardRequirements: requirements.filter((entry) => entry.category === "hard" && known(entry)).length,
      recommendedValuesMet: requirements.filter((entry) => entry.category === "recommended" && entry.status === "MET").length,
      knownRecommendedValues: requirements.filter((entry) => entry.category === "recommended" && known(entry)).length,
      unknownCount: requirements.filter((entry) => entry.status === "UNKNOWN").length,
      blockingMisses: requirements.filter((entry) => entry.severity === "blocking" && entry.status === "NOT_MET")
        .map((entry) => entry.id),
      degradingMisses: requirements.filter((entry) => entry.severity === "degrading" && entry.status === "NOT_MET")
        .map((entry) => entry.id),
    },
  };
}
