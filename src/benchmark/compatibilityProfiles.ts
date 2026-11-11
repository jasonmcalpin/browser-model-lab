import type { BenchmarkWorkload, BrowserModelCandidate, GenerationSettings, ModelAdapterId,
  PromptPlacement, RuntimeKind, ToolCallFormat, ToolSupportMode } from "./types";

type Profile = Omit<GenerationSettings, "maxNewTokens">;

export interface ModelCompatibilityProfile {
  readonly id: string;
  readonly family: string;
  readonly runtime: {
    readonly kind: RuntimeKind;
    readonly pipelineTask?: "text-generation";
    readonly modelClass?: "Qwen3_5ForConditionalGeneration";
    readonly processorClass?: "AutoProcessor";
    readonly dtype: BrowserModelCandidate["dtype"] | Readonly<Record<string, "q4" | "fp16">>;
    readonly minimumTransformersJs?: string;
  };
  readonly chat: {
    readonly promptPlacement: PromptPlacement;
    readonly nativeTemplate: boolean;
    readonly historyReasoning: "preserve" | "strip" | "template-managed" | "unknown";
  };
  readonly tools: {
    readonly mode: ToolSupportMode;
    readonly callFormat: ToolCallFormat;
    readonly tokenizerTools: boolean;
  };
  readonly reasoning: {
    readonly supported: boolean | "unknown";
    readonly defaultMode: "thinking" | "non-thinking" | "unknown";
    readonly control?: "enable_thinking" | "forced-think-prefix" | "template-managed";
    readonly enabledForBenchmark: boolean;
  };
  readonly profiles: Readonly<Record<BenchmarkWorkload, Profile>>;
  readonly visionProfile?: Profile;
  readonly adapterId: ModelAdapterId;
  readonly sources: readonly string[];
}

const greedy: Profile = { doSample: false };
const qwen3NonThinking: Profile = { doSample: true, temperature: 0.7, topP: 0.8, topK: 20, minP: 0 };
const deepseek: Profile = { doSample: true, temperature: 0.6, topP: 0.95 };
const qwen35NonThinking: Profile = {
  doSample: true, temperature: 1.0, topP: 1.0, topK: 20, minP: 0, presencePenalty: 2.0, repetitionPenalty: 1.0,
};
const qwen35VisionNonThinking: Profile = {
  doSample: true, temperature: 0.7, topP: 0.8, topK: 20, minP: 0, presencePenalty: 1.5, repetitionPenalty: 1.0,
};
const bonsai: Profile = { doSample: true, temperature: 0.5, topP: 0.9, topK: 20, repetitionPenalty: 1.0 };
const lfm3: Profile = { doSample: true, temperature: 0.1, topK: 50, repetitionPenalty: 1.1 };

export const MODEL_COMPATIBILITY_PROFILES: Readonly<Record<string, ModelCompatibilityProfile>> = {
  "qwen3-nonthinking-native-v1": {
    id: "qwen3-nonthinking-native-v1", family: "qwen3",
    runtime: { kind: "pipeline", pipelineTask: "text-generation", dtype: "q4f16" },
    chat: { promptPlacement: "preserve-roles", nativeTemplate: true, historyReasoning: "template-managed" },
    tools: { mode: "native-template", callFormat: "qwen-native", tokenizerTools: true },
    reasoning: { supported: true, defaultMode: "thinking", control: "enable_thinking", enabledForBenchmark: false },
    profiles: { production: qwen3NonThinking, direct: qwen3NonThinking, tool: qwen3NonThinking },
    adapterId: "qwen3",
    sources: ["https://huggingface.co/Qwen/Qwen3-0.6B", "https://huggingface.co/Qwen/Qwen3-0.6B/blob/main/tokenizer_config.json"],
  },
  "deepseek-r1-distill-prompted-v1": {
    id: "deepseek-r1-distill-prompted-v1", family: "deepseek-r1-qwen",
    runtime: { kind: "pipeline", pipelineTask: "text-generation", dtype: "q4f16" },
    chat: { promptPlacement: "user-only", nativeTemplate: true, historyReasoning: "strip" },
    tools: { mode: "prompted-protocol", callFormat: "canonical-json", tokenizerTools: false },
    reasoning: { supported: true, defaultMode: "thinking", control: "forced-think-prefix", enabledForBenchmark: true },
    profiles: { production: deepseek, direct: deepseek, tool: deepseek },
    adapterId: "deepseek-r1",
    sources: ["https://huggingface.co/deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B", "https://huggingface.co/deepseek-ai/DeepSeek-R1"],
  },
  "smollm2-function-prompt-v1": {
    id: "smollm2-function-prompt-v1", family: "smollm2",
    runtime: { kind: "pipeline", pipelineTask: "text-generation", dtype: "q4f16" },
    chat: { promptPlacement: "preserve-roles", nativeTemplate: true, historyReasoning: "unknown" },
    tools: { mode: "prompted-protocol", callFormat: "smollm2-native", tokenizerTools: false },
    reasoning: { supported: false, defaultMode: "non-thinking", enabledForBenchmark: false },
    profiles: { production: { doSample: true, temperature: 0.2, topP: 0.9 }, direct: greedy, tool: greedy },
    adapterId: "smollm2",
    sources: ["https://huggingface.co/HuggingFaceTB/SmolLM2-1.7B-Instruct"],
  },
  "gemma3-browser-chat-v1": {
    id: "gemma3-browser-chat-v1", family: "gemma3",
    runtime: { kind: "pipeline", pipelineTask: "text-generation", dtype: "q4" },
    chat: { promptPlacement: "preserve-roles", nativeTemplate: true, historyReasoning: "unknown" },
    tools: { mode: "unknown", callFormat: "canonical-json", tokenizerTools: false },
    reasoning: { supported: "unknown", defaultMode: "unknown", enabledForBenchmark: false },
    profiles: { production: greedy, direct: greedy, tool: greedy },
    adapterId: "generic-chat",
    sources: ["https://huggingface.co/google/gemma-3-1b-it", "https://huggingface.co/onnx-community/gemma-3-1b-it-ONNX-GQA"],
  },
  "qwen35-text-pipeline-nonthinking-v1": {
    id: "qwen35-text-pipeline-nonthinking-v1", family: "qwen3.5",
    runtime: { kind: "pipeline", pipelineTask: "text-generation", dtype: "q4", minimumTransformersJs: "4.3.2" },
    chat: { promptPlacement: "preserve-roles", nativeTemplate: true, historyReasoning: "strip" },
    tools: { mode: "unknown", callFormat: "canonical-json", tokenizerTools: false },
    reasoning: { supported: true, defaultMode: "non-thinking", control: "template-managed", enabledForBenchmark: false },
    profiles: { production: qwen35NonThinking, direct: qwen35NonThinking, tool: qwen35NonThinking },
    adapterId: "qwen3.5",
    sources: ["https://huggingface.co/onnx-community/Qwen3.5-0.8B-Text-ONNX", "https://huggingface.co/Qwen/Qwen3.5-0.8B"],
  },
  "qwen35-multimodal-nonthinking-v1": {
    id: "qwen35-multimodal-nonthinking-v1", family: "qwen3.5",
    runtime: {
      kind: "direct-model", modelClass: "Qwen3_5ForConditionalGeneration", processorClass: "AutoProcessor",
      dtype: { embed_tokens: "q4", vision_encoder: "fp16", decoder_model_merged: "q4" }, minimumTransformersJs: "4.3.2",
    },
    chat: { promptPlacement: "preserve-roles", nativeTemplate: true, historyReasoning: "strip" },
    tools: { mode: "unknown", callFormat: "canonical-json", tokenizerTools: false },
    reasoning: { supported: true, defaultMode: "non-thinking", control: "template-managed", enabledForBenchmark: false },
    profiles: { production: qwen35NonThinking, direct: qwen35NonThinking, tool: qwen35NonThinking },
    visionProfile: qwen35VisionNonThinking,
    adapterId: "qwen3.5",
    sources: ["https://huggingface.co/onnx-community/Qwen3.5-0.8B-ONNX", "https://huggingface.co/Qwen/Qwen3.5-0.8B"],
  },
  "qwen35-text-nonthinking-v1": {
    id: "qwen35-text-nonthinking-v1", family: "qwen3.5",
    runtime: {
      kind: "direct-model", modelClass: "Qwen3_5ForConditionalGeneration", processorClass: "AutoProcessor",
      dtype: { embed_tokens: "q4", vision_encoder: "fp16", decoder_model_merged: "q4" }, minimumTransformersJs: "4.3.2",
    },
    chat: { promptPlacement: "preserve-roles", nativeTemplate: true, historyReasoning: "strip" },
    tools: { mode: "unknown", callFormat: "canonical-json", tokenizerTools: false },
    reasoning: { supported: true, defaultMode: "non-thinking", control: "template-managed", enabledForBenchmark: false },
    profiles: { production: qwen35NonThinking, direct: qwen35NonThinking, tool: qwen35NonThinking },
    visionProfile: qwen35VisionNonThinking,
    adapterId: "qwen3.5",
    sources: ["https://huggingface.co/onnx-community/Qwen3.5-2B-ONNX", "https://huggingface.co/Qwen/Qwen3.5-2B"],
  },
  "llama32-native-chat-v1": {
    id: "llama32-native-chat-v1", family: "llama3.2",
    runtime: { kind: "pipeline", pipelineTask: "text-generation", dtype: "q4f16" },
    chat: { promptPlacement: "preserve-roles", nativeTemplate: true, historyReasoning: "unknown" },
    tools: { mode: "unknown", callFormat: "canonical-json", tokenizerTools: false },
    reasoning: { supported: false, defaultMode: "non-thinking", enabledForBenchmark: false },
    profiles: { production: greedy, direct: greedy, tool: greedy },
    adapterId: "generic-chat",
    sources: ["https://huggingface.co/meta-llama/Llama-3.2-1B-Instruct"],
  },
  "falcon3-native-chat-v1": {
    id: "falcon3-native-chat-v1", family: "falcon3",
    runtime: { kind: "pipeline", pipelineTask: "text-generation", dtype: "q4f16" },
    chat: { promptPlacement: "preserve-roles", nativeTemplate: true, historyReasoning: "unknown" },
    tools: { mode: "unknown", callFormat: "canonical-json", tokenizerTools: false },
    reasoning: { supported: false, defaultMode: "non-thinking", enabledForBenchmark: false },
    profiles: { production: greedy, direct: greedy, tool: greedy },
    adapterId: "generic-chat",
    sources: ["https://huggingface.co/tiiuae/Falcon3-1B-Instruct"],
  },
  "granite4-native-tools-v1": {
    id: "granite4-native-tools-v1", family: "granite4",
    runtime: { kind: "pipeline", pipelineTask: "text-generation", dtype: "q4f16" },
    chat: { promptPlacement: "preserve-roles", nativeTemplate: true, historyReasoning: "unknown" },
    tools: { mode: "native-template", callFormat: "qwen-native", tokenizerTools: true },
    reasoning: { supported: false, defaultMode: "non-thinking", enabledForBenchmark: false },
    profiles: { production: greedy, direct: greedy, tool: greedy },
    adapterId: "granite4",
    sources: ["https://huggingface.co/ibm-granite/granite-4.0-1b"],
  },
  "lfm3-native-tools-v1": {
    id: "lfm3-native-tools-v1", family: "lfm3",
    runtime: { kind: "pipeline", pipelineTask: "text-generation", dtype: "q4f16", minimumTransformersJs: "4.3.2" },
    chat: { promptPlacement: "preserve-roles", nativeTemplate: true, historyReasoning: "template-managed" },
    tools: { mode: "native-template", callFormat: "lfm3-xml", tokenizerTools: true },
    reasoning: { supported: true, defaultMode: "thinking", control: "enable_thinking", enabledForBenchmark: false },
    profiles: { production: lfm3, direct: lfm3, tool: lfm3 },
    adapterId: "lfm3",
    sources: ["https://huggingface.co/LiquidAI/LFM3-1.7B", "https://huggingface.co/onnx-community/LFM3-1.7B-ONNX"],
  },
  "bonsai-native-tools-v1": {
    id: "bonsai-native-tools-v1", family: "bonsai-qwen3",
    runtime: { kind: "pipeline", pipelineTask: "text-generation", dtype: "q4" },
    chat: { promptPlacement: "preserve-roles", nativeTemplate: true, historyReasoning: "template-managed" },
    tools: { mode: "native-template", callFormat: "qwen-native", tokenizerTools: true },
    reasoning: { supported: true, defaultMode: "non-thinking", control: "template-managed", enabledForBenchmark: false },
    profiles: { production: bonsai, direct: bonsai, tool: bonsai },
    adapterId: "bonsai",
    sources: ["https://huggingface.co/onnx-community/Bonsai-1.7B-ONNX", "https://huggingface.co/prism-ml/Bonsai-1.7B-gguf"],
  },
};

export function compatibilityProfileFor(candidate: BrowserModelCandidate): ModelCompatibilityProfile {
  const profile = MODEL_COMPATIBILITY_PROFILES[candidate.compatibilityProfileId];
  if (!profile) throw new Error(`Unknown compatibility profile: ${candidate.compatibilityProfileId}`);
  return profile;
}
