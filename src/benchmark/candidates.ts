import type { BrowserModelCandidate } from "./types";
import { compatibilityProfileFor } from "./compatibilityProfiles";

const MIB = 1024 * 1024;

export const BROWSER_AI_BENCHMARK_CANDIDATES: readonly BrowserModelCandidate[] = [
  {
    id: "qwen3-0.6b-q4f16-control", label: "Qwen3-0.6B q4f16 (production control)",
    modelId: "onnx-community/Qwen3-0.6B-ONNX", revision: "main", backend: "webgpu", dtype: "q4f16", pipelineTask: "text-generation",
    family: "qwen3", adapterId: "qwen3", approximateArtifactBytes: Math.round(543.4 * MIB),
    compatibilityProfileId: "qwen3-nonthinking-native-v1", template: { kind: "qwen3", enableThinking: false }, structuredOutput: "json-fallback",
  },
  {
    id: "qwen3-1.7b-q4f16", label: "Qwen3-1.7B q4f16",
    modelId: "onnx-community/Qwen3-1.7B-ONNX", revision: "c660498e3dbc453049f81ecf5c773e4c3d4a6e7f",
    backend: "webgpu", dtype: "q4f16", pipelineTask: "text-generation", family: "qwen3", adapterId: "qwen3", approximateArtifactBytes: 1_740_000_000,
    compatibilityProfileId: "qwen3-nonthinking-native-v1", template: { kind: "qwen3", enableThinking: false }, structuredOutput: "json-fallback",
  },
  {
    id: "deepseek-r1-distill-qwen-1.5b-q4f16", label: "DeepSeek-R1-Distill-Qwen-1.5B q4f16",
    modelId: "onnx-community/DeepSeek-R1-Distill-Qwen-1.5B-ONNX",
    revision: "f9c94fd59ec97bdb5e7587d09343797481a8c385", backend: "webgpu", dtype: "q4f16", pipelineTask: "text-generation",
    family: "deepseek-r1-qwen", adapterId: "deepseek-r1", approximateArtifactBytes: 1_370_000_000,
    compatibilityProfileId: "deepseek-r1-distill-prompted-v1", template: { kind: "deepseek-r1" }, structuredOutput: "json-fallback",
  },
  {
    id: "smollm2-1.7b-instruct-q4f16", label: "SmolLM2-1.7B-Instruct q4f16",
    modelId: "HuggingFaceTB/SmolLM2-1.7B-Instruct", revision: "84e8f3e31df252d9cdd9a1da5aa0adefe4dac0ea",
    backend: "webgpu", dtype: "q4f16", pipelineTask: "text-generation", family: "smollm2", adapterId: "smollm2", approximateArtifactBytes: 1_170_000_000,
    compatibilityProfileId: "smollm2-function-prompt-v1", template: { kind: "smollm2-instruct" }, structuredOutput: "json-fallback",
  },
  {
    id: "gemma3-1b-it-q4", label: "Gemma 3 1B IT q4",
    modelId: "onnx-community/gemma-3-1b-it-ONNX", revision: "main",
    backend: "webgpu", dtype: "q4", pipelineTask: "text-generation", family: "gemma3",
    adapterId: "generic-chat", compatibilityProfileId: "gemma3-browser-chat-v1", template: { kind: "hf-chat-template" }, structuredOutput: "json-fallback",
  },
  {
    id: "qwen35-0.8b-q4f16", label: "Qwen3.5-0.8B Text q4",
    modelId: "onnx-community/Qwen3.5-0.8B-Text-ONNX", revision: "main",
    backend: "webgpu", dtype: "q4", pipelineTask: "text-generation", family: "qwen3.5",
    adapterId: "qwen3.5", compatibilityProfileId: "qwen35-text-pipeline-nonthinking-v1", template: { kind: "hf-chat-template" }, structuredOutput: "json-fallback",
  },
  {
    id: "qwen35-0.8b-multimodal", label: "Qwen3.5-0.8B Multimodal q4/fp16",
    modelId: "onnx-community/Qwen3.5-0.8B-ONNX", revision: "main",
    backend: "webgpu", dtype: "mixed", pipelineTask: "direct-model", family: "qwen3.5",
    adapterId: "qwen3.5", compatibilityProfileId: "qwen35-multimodal-nonthinking-v1",
    template: { kind: "hf-chat-template" }, structuredOutput: "json-fallback",
  },
  {
    id: "qwen35-2b-q4f16", label: "Qwen3.5-2B mixed q4/fp16",
    modelId: "onnx-community/Qwen3.5-2B-ONNX", revision: "main",
    backend: "webgpu", dtype: "mixed", pipelineTask: "direct-model", family: "qwen3.5",
    adapterId: "qwen3.5", compatibilityProfileId: "qwen35-text-nonthinking-v1", template: { kind: "hf-chat-template" }, structuredOutput: "json-fallback",
  },
  {
    id: "llama32-1b-instruct-q4f16", label: "Llama 3.2 1B Instruct q4f16",
    modelId: "onnx-community/Llama-3.2-1B-Instruct-ONNX", revision: "main",
    backend: "webgpu", dtype: "q4f16", pipelineTask: "text-generation", family: "llama3.2",
    adapterId: "generic-chat", compatibilityProfileId: "llama32-native-chat-v1", template: { kind: "hf-chat-template" }, structuredOutput: "json-fallback",
  },
  {
    id: "falcon3-1b-instruct-q4f16", label: "Falcon3 1B Instruct q4f16",
    modelId: "onnx-community/Falcon3-1B-Instruct", revision: "main",
    backend: "webgpu", dtype: "q4f16", pipelineTask: "text-generation", family: "falcon3",
    adapterId: "generic-chat", compatibilityProfileId: "falcon3-native-chat-v1", template: { kind: "hf-chat-template" }, structuredOutput: "json-fallback",
  },
  {
    id: "granite4-1b-q4f16", label: "Granite 4.0 1B q4f16",
    modelId: "onnx-community/granite-4.0-1b-ONNX-web", revision: "main",
    backend: "webgpu", dtype: "q4f16", pipelineTask: "text-generation", family: "granite4",
    adapterId: "granite4", compatibilityProfileId: "granite4-native-tools-v1", template: { kind: "hf-chat-template" }, structuredOutput: "json-fallback",
  },
  {
    id: "lfm3-1.7b-q4f16", label: "LFM3 1.7B q4f16",
    modelId: "onnx-community/LFM3-1.7B-ONNX", revision: "main",
    backend: "webgpu", dtype: "q4f16", pipelineTask: "text-generation", family: "lfm3",
    adapterId: "lfm3", compatibilityProfileId: "lfm3-native-tools-v1", template: { kind: "hf-chat-template" }, structuredOutput: "json-fallback",
  },
  {
    id: "bonsai-1.7b-q4", label: "Bonsai 1.7B q4",
    modelId: "onnx-community/Bonsai-1.7B-ONNX", revision: "main",
    backend: "webgpu", dtype: "q4", pipelineTask: "text-generation", family: "bonsai-qwen3",
    adapterId: "bonsai", compatibilityProfileId: "bonsai-native-tools-v1", template: { kind: "hf-chat-template" }, structuredOutput: "json-fallback",
  }
] as const;

export function candidateById(id: string): BrowserModelCandidate {
  const candidate = BROWSER_AI_BENCHMARK_CANDIDATES.find((entry) => entry.id === id);
  if (!candidate) throw new Error(`Unknown benchmark candidate: ${id}`);
  return candidate;
}

export function validateCandidateRegistry(candidates: readonly BrowserModelCandidate[]): void {
  const ids = new Set<string>();
  for (const candidate of candidates) {
    if (!candidate.id || ids.has(candidate.id)) throw new Error(`Duplicate or empty candidate id: ${candidate.id}`);
    if (!/^[\w.-]+\/[\w.-]+$/.test(candidate.modelId) || !candidate.revision) throw new Error(`Invalid candidate artifact: ${candidate.id}`);
    if (candidate.backend !== "webgpu" || !["q4f16", "q4", "mixed"].includes(candidate.dtype))
      throw new Error(`Unsupported benchmark runtime: ${candidate.id}`);
    if (!["text-generation", "direct-model"].includes(candidate.pipelineTask))
      throw new Error(`Unsupported benchmark pipeline: ${candidate.id}`);
    const profile = compatibilityProfileFor(candidate);
    if (profile.adapterId !== candidate.adapterId)
      throw new Error(`Compatibility profile adapter mismatch: ${candidate.id}`);
    if (profile.family !== candidate.family)
      throw new Error(`Compatibility profile family mismatch: ${candidate.id}`);
    ids.add(candidate.id);
  }
}

validateCandidateRegistry(BROWSER_AI_BENCHMARK_CANDIDATES);
