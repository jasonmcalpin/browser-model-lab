import { buildModelInvocation, buildVisionInvocation, parseAdapterOutput } from "./modelAdapters";
import { createModelRuntime, type ModelRuntime } from "./modelRuntime";
import type { BenchmarkRuntimeClient, RuntimeProgressListener } from "./runtimeClient";
import type { BrowserModelCandidate, CanonicalGenerationRequest, GenerationMetrics, GenerationResult,
  InitializationMetrics, ModelInvocation, ModelMessage, ModelTemplateEvidence, VisionGenerationResult } from "./types";

type TransformersRuntime = typeof import("@huggingface/transformers");

function renderTemplate(runtime: ModelRuntime, invocation: ModelInvocation): {
  readonly renderedPrompt?: string; readonly error?: string;
} {
  try {
    return { renderedPrompt: runtime.renderPrompt(invocation.messages, invocation.tokenizerEncodeOptions) };
  } catch (error) {
    return { error: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500) };
  }
}

function captureTemplateEvidence(runtime: ModelRuntime, selected: BrowserModelCandidate): ModelTemplateEvidence {
  const chat = buildModelInvocation(selected, {
    messages: [
      { role: "system", content: "SYSTEM TEMPLATE PROBE" },
      { role: "user", content: "USER TEMPLATE PROBE" },
    ],
    maxNewTokens: 32,
    workload: "direct",
  });
  const tools = buildModelInvocation(selected, {
    messages: [
      { role: "system", content: "SYSTEM TEMPLATE PROBE" },
      { role: "user", content: "Inspect relay R-17." },
    ],
    maxNewTokens: 32,
    workload: "tool",
    tools: [{
      name: "inspect_relay",
      description: "Inspect one relay.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string", description: "Relay id." } },
        required: ["id"],
        additionalProperties: false,
      },
    }],
  });
  return {
    ...(runtime.templateSource ? { templateSource: runtime.templateSource } : {}),
    chat: { invocation: chat, ...renderTemplate(runtime, chat) },
    tools: { invocation: tools, ...renderTemplate(runtime, tools) },
  };
}

function generationOptions(settings: ModelInvocation["settings"], streamer: unknown, stoppingCriteria: unknown): Record<string, unknown> {
  return {
    max_new_tokens: settings.maxNewTokens,
    ...(settings.doSample === undefined ? {} : { do_sample: settings.doSample }),
    ...(settings.temperature === undefined ? {} : { temperature: settings.temperature }),
    ...(settings.topP === undefined ? {} : { top_p: settings.topP }),
    ...(settings.topK === undefined ? {} : { top_k: settings.topK }),
    ...(settings.presencePenalty === undefined ? {} : { presence_penalty: settings.presencePenalty }),
    ...(settings.repetitionPenalty === undefined ? {} : { repetition_penalty: settings.repetitionPenalty }),
    ...(settings.minP === undefined ? {} : { min_p: settings.minP }),
    streamer,
    stopping_criteria: [stoppingCriteria],
  };
}

export class NodeBenchmarkRuntimeClient implements BenchmarkRuntimeClient {
  private runtimeModule: TransformersRuntime | undefined;
  private modelRuntime: ModelRuntime | undefined;
  private stoppingCriteria: { interrupt(): void; reset(): void } | undefined;
  private candidate: BrowserModelCandidate | undefined;
  private cancelled = false;

  constructor(private readonly onProgress: RuntimeProgressListener = () => undefined) {}

  async initialize(candidate: BrowserModelCandidate): Promise<InitializationMetrics> {
    if (this.modelRuntime) await this.disposeModel();
    const started = performance.now();
    const runtime = await import("@huggingface/transformers");
    this.runtimeModule = runtime;
    runtime.env.useBrowserCache = false;
    const requested = new Set<string>();
    const loadedByFile = new Map<string, number>();
    this.onProgress("INITIALIZING", `Loading ${candidate.label}`);
    this.modelRuntime = await createModelRuntime(runtime, candidate, (progress) => {
      if (!progress.file) return;
      requested.add(`https://huggingface.co/${candidate.modelId}/resolve/${candidate.revision}/${progress.file}`);
      if (typeof progress.loaded === "number")
        loadedByFile.set(progress.file, Math.max(loadedByFile.get(progress.file) ?? 0, progress.loaded));
      this.onProgress(progress.status ?? "LOADING", progress.file);
    });
    this.candidate = candidate;
    this.stoppingCriteria = new runtime.InterruptableStoppingCriteria();
    this.cancelled = false;
    return {
      readyMs: performance.now() - started,
      templateEvidence: captureTemplateEvidence(this.modelRuntime, candidate),
      cacheEntriesBefore: [],
      cacheEntriesAfter: [],
      requestedUrls: [...requested],
      bytesObserved: [...loadedByFile.values()].reduce((sum, value) => sum + value, 0),
    };
  }

  async generate(request: CanonicalGenerationRequest): Promise<GenerationResult> {
    if (!this.modelRuntime || !this.candidate || !this.runtimeModule || !this.stoppingCriteria)
      throw new Error("Benchmark model is not initialized.");
    const invocation = buildModelInvocation(this.candidate, request);
    this.stoppingCriteria.reset();
    this.cancelled = false;
    const started = performance.now();
    let firstTokenAt: number | undefined;
    let tokenCount = 0;
    let raw = "";
    const streamer = new this.runtimeModule.TextStreamer(this.modelRuntime.tokenizer as never, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (text: string) => { if (!this.cancelled) raw += text; },
      token_callback_function: () => { tokenCount += 1; firstTokenAt ??= performance.now(); },
    });
    await this.modelRuntime.generate(invocation.messages as readonly ModelMessage[], {
      ...generationOptions(invocation.settings, streamer, this.stoppingCriteria),
      ...(invocation.tokenizerEncodeOptions ? { tokenizer_encode_kwargs: invocation.tokenizerEncodeOptions } : {}),
    });
    if (this.cancelled) throw new Error("Generation cancelled.");
    const generationMs = performance.now() - started;
    const metrics: GenerationMetrics = {
      ...(firstTokenAt === undefined ? {} : { firstTokenMs: firstTokenAt - started }),
      generationMs,
      generatedTokens: tokenCount,
      tokensPerSecond: generationMs ? tokenCount / (generationMs / 1000) : 0,
      termination: tokenCount >= invocation.settings.maxNewTokens ? "TOKEN_LIMIT" : "UNKNOWN",
    };
    const extracted = parseAdapterOutput(this.candidate, raw);
    return {
      raw,
      final: extracted.final,
      metrics: { ...metrics, ...(extracted.reasoningTokens === undefined ? {} : { reasoningTokens: extracted.reasoningTokens }) },
      invocation,
      ...(extracted.turn ? { turn: extracted.turn } : {}),
    };
  }

  async generateVision(imageUrl: string, prompt: string, maxNewTokens = 96): Promise<VisionGenerationResult> {
    if (!this.modelRuntime || !this.candidate || !this.runtimeModule || !this.stoppingCriteria)
      throw new Error("Benchmark model is not initialized.");
    if (!this.modelRuntime.generateVision) throw new Error("Candidate runtime does not support image input.");
    const invocation = buildVisionInvocation(this.candidate, imageUrl, prompt, maxNewTokens);
    this.stoppingCriteria.reset();
    this.cancelled = false;
    const started = performance.now();
    let firstTokenAt: number | undefined;
    let tokenCount = 0;
    let raw = "";
    const streamer = new this.runtimeModule.TextStreamer(this.modelRuntime.tokenizer as never, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (text: string) => { if (!this.cancelled) raw += text; },
      token_callback_function: () => { tokenCount += 1; firstTokenAt ??= performance.now(); },
    });
    await this.modelRuntime.generateVision(imageUrl, prompt, generationOptions(invocation.settings, streamer, this.stoppingCriteria));
    if (this.cancelled) throw new Error("Generation cancelled.");
    const generationMs = performance.now() - started;
    return {
      raw,
      final: raw.trim(),
      metrics: {
        ...(firstTokenAt === undefined ? {} : { firstTokenMs: firstTokenAt - started }),
        generationMs,
        generatedTokens: tokenCount,
        tokensPerSecond: generationMs ? tokenCount / (generationMs / 1000) : 0,
        termination: tokenCount >= invocation.settings.maxNewTokens ? "TOKEN_LIMIT" : "UNKNOWN",
      },
      invocation,
    };
  }

  cancel(): void {
    this.cancelled = true;
    this.stoppingCriteria?.interrupt();
  }

  async disposeModel(): Promise<void> {
    this.stoppingCriteria?.interrupt();
    await this.modelRuntime?.dispose();
    this.modelRuntime = undefined;
    this.stoppingCriteria = undefined;
    this.candidate = undefined;
    this.cancelled = false;
  }

  async clearCache(): Promise<void> {
    throw new Error("Headless Node cold-cache clearing is not defined yet. Use --cached.");
  }

  terminate(): void {
    this.cancel();
  }
}
