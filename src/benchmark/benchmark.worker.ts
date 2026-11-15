/// <reference lib="webworker" />
import type { BenchmarkWorkerRequest, BenchmarkWorkerResponse, BrowserModelCandidate, CacheEntryMetric,
  GenerationMetrics, ModelInvocation, ModelTemplateEvidence } from "./types";
import { createModelRuntime, type ModelRuntime } from "./modelRuntime";
import { createArcanAIModelExecutor, type ArcanAIModelExecutor } from "./arcanaiExecution";
import { buildModelInvocation } from "./modelAdapters";
import { toolDefinitions } from "./toolHarness";

let generator: ModelRuntime | null = null;
let candidate: BrowserModelCandidate | null = null;
let stoppingCriteria: { interrupt(): void; reset(): void } | null = null;
let activeRequestId: string | null = null;
let executionAbort: AbortController | null = null;
let arcanai: ArcanAIModelExecutor | null = null;

const cacheKey = (candidateId: string) => `browser-model-lab-v1-${candidateId}`;
const emit = (message: BenchmarkWorkerResponse) => self.postMessage(message);
const boundedError = (error: unknown) => (error instanceof Error ? error.message : String(error)).slice(0, 500);

async function cacheSnapshot(key: string): Promise<{ entries: CacheEntryMetric[]; bytes?: number }> {
  if (!("caches" in self)) return { entries: [] };
  const keys = await caches.keys();
  if (!keys.includes(key)) return { entries: [], bytes: 0 };
  const cache = await caches.open(key);
  const requests = await cache.keys();
  let bytes = 0;
  let allKnown = true;
  const entries: CacheEntryMetric[] = [];
  for (const request of requests) {
    const response = await cache.match(request);
    const length = Number(response?.headers.get("content-length"));
    if (Number.isFinite(length) && length >= 0) { bytes += length; entries.push({ url: request.url, bytes: length }); }
    else { allKnown = false; entries.push({ url: request.url }); }
  }
  return { entries, ...(allKnown ? { bytes } : {}) };
}

function renderTemplate(runtime: ModelRuntime, invocation: ModelInvocation): {
  readonly renderedPrompt?: string; readonly error?: string;
} {
  try {
    return { renderedPrompt: runtime.renderPrompt(invocation.messages, invocation.tokenizerEncodeOptions) };
  } catch (error) {
    return { error: boundedError(error) };
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
    tools: toolDefinitions(["inspect_relay"]),
  });
  return {
    ...(runtime.templateSource ? { templateSource: runtime.templateSource } : {}),
    chat: { invocation: chat, ...renderTemplate(runtime, chat) },
    tools: { invocation: tools, ...renderTemplate(runtime, tools) },
  };
}

async function initialize(selected: BrowserModelCandidate): Promise<void> {
  if (!("gpu" in navigator)) throw new Error("WebGPU is unavailable in this browser.");
  if (generator) await dispose();
  const started = performance.now();
  const key = cacheKey(selected.id);
  const before = await cacheSnapshot(key);
  emit({ type: "PROGRESS", phase: "INITIALIZING", detail: `Loading ${selected.label}` });
  const runtime = await import("@huggingface/transformers");
  runtime.env.cacheKey = key;
  runtime.env.useBrowserCache = true;
  runtime.env.useWasmCache = false;
  const requested = new Set<string>();
  const loadedByFile = new Map<string, number>();
  const loaded = await createModelRuntime(runtime, selected,
    (progress: { status?: string; file?: string; loaded?: number }) => {
      if (!progress.file) return;
      const url = `https://huggingface.co/${selected.modelId}/resolve/${selected.revision}/${progress.file}`;
      requested.add(url);
      if (typeof progress.loaded === "number") loadedByFile.set(progress.file, Math.max(loadedByFile.get(progress.file) ?? 0, progress.loaded));
      emit({ type: "PROGRESS", phase: progress.status ?? "LOADING", detail: progress.file });
    });
  generator = loaded;
  candidate = selected;
  stoppingCriteria = loaded.stoppingCriteria;
  arcanai = createArcanAIModelExecutor(selected, loaded);
  const after = await cacheSnapshot(key);
  const templateEvidence = captureTemplateEvidence(loaded, selected);
  emit({ type: "READY", metrics: {
    readyMs: performance.now() - started,
    templateEvidence,
    cacheEntriesBefore: before.entries,
    cacheEntriesAfter: after.entries,
    ...(before.bytes === undefined ? {} : { cacheBytesBefore: before.bytes }),
    ...(after.bytes === undefined ? {} : { cacheBytesAfter: after.bytes }),
    requestedUrls: [...requested],
    bytesObserved: [...loadedByFile.values()].reduce((sum, value) => sum + value, 0),
  } });
}

async function generate(request: Extract<BenchmarkWorkerRequest, { type: "GENERATE" }>): Promise<void> {
  if (!generator || !candidate || !stoppingCriteria || !arcanai) throw new Error("Benchmark model is not ready.");
  if (activeRequestId) throw new Error("A generation is already active.");
  const { invocation } = request;
  if (!invocation.messages.length || invocation.settings.maxNewTokens < 1 || invocation.settings.maxNewTokens > 1536)
    throw new Error("Invalid generation request.");

  const controller = new AbortController();
  executionAbort = controller;
  activeRequestId = request.requestId;
  const started = performance.now();
  let tokenCount = 0;
  let firstTokenAt: number | undefined;
  try {
    const result = await arcanai.generate(invocation, controller.signal, {
      onText(text) {
        if (activeRequestId === request.requestId && !controller.signal.aborted) {
          emit({ type: "TOKEN", requestId: request.requestId, text, tokenCount });
        }
      },
      onToken(count) {
        tokenCount = count;
        firstTokenAt ??= performance.now();
      }
    });
    if (controller.signal.aborted || activeRequestId !== request.requestId) {
      emit({ type: "CANCELLED", requestId: request.requestId, metrics: result.metrics });
    } else {
      emit({ type: "COMPLETE", requestId: request.requestId, raw: result.raw, metrics: result.metrics });
    }
  } catch (error) {
    if (controller.signal.aborted || activeRequestId !== request.requestId) {
      const ms = performance.now() - started;
      emit({ type: "CANCELLED", requestId: request.requestId, metrics: {
        ...(firstTokenAt === undefined ? {} : { firstTokenMs: firstTokenAt - started }),
        generationMs: ms, generatedTokens: tokenCount,
        tokensPerSecond: ms > 0 ? tokenCount / (ms / 1000) : 0,
        termination: "CANCELLED"
      } });
    } else {
      throw error;
    }
  } finally {
    if (executionAbort === controller) executionAbort = null;
    if (activeRequestId === request.requestId) activeRequestId = null;
  }
}


async function generateVision(request: Extract<BenchmarkWorkerRequest, { type: "GENERATE_VISION" }>): Promise<void> {
  if (!generator || !candidate || !arcanai || !stoppingCriteria) throw new Error("Benchmark model is not ready.");
  if (!generator.generateVision) throw new Error("Candidate runtime does not support image input.");
  if (activeRequestId) throw new Error("A generation is already active.");
  const { invocation } = request;
  if (invocation.settings.maxNewTokens < 1 || invocation.settings.maxNewTokens > 768)
    throw new Error("Invalid vision generation request.");
  const controller = new AbortController();
  executionAbort = controller;
  activeRequestId = request.requestId;
  const started = performance.now();
  let tokenCount = 0;
  let firstTokenAt: number | undefined;
  try {
    const result = await arcanai.generateVision(invocation, controller.signal, {
      onText(text) {
        if (activeRequestId === request.requestId && !controller.signal.aborted) {
          emit({ type: "TOKEN", requestId: request.requestId, text, tokenCount });
        }
      },
      onToken(count) {
        tokenCount = count;
        firstTokenAt ??= performance.now();
      }
    });
    if (controller.signal.aborted || activeRequestId !== request.requestId) {
      emit({ type: "CANCELLED", requestId: request.requestId, metrics: result.metrics });
    } else {
      emit({ type: "COMPLETE", requestId: request.requestId, raw: result.raw, metrics: result.metrics });
    }
  } catch (error) {
    if (controller.signal.aborted || activeRequestId !== request.requestId) {
      const ms = performance.now() - started;
      emit({ type: "CANCELLED", requestId: request.requestId, metrics: {
        ...(firstTokenAt === undefined ? {} : { firstTokenMs: firstTokenAt - started }),
        generationMs: ms, generatedTokens: tokenCount,
        tokensPerSecond: ms > 0 ? tokenCount / (ms / 1000) : 0,
        termination: "CANCELLED"
      } });
    } else throw error;
  } finally {
    if (executionAbort === controller) executionAbort = null;
    if (activeRequestId === request.requestId) activeRequestId = null;
  }
}

async function tokenize(request: Extract<BenchmarkWorkerRequest, { type: "TOKENIZE" }>): Promise<void> {
  if (!generator || activeRequestId) throw new Error("Model unavailable for token inspection.");
  const renderedPrompt = generator.renderPrompt(request.invocation.messages, request.invocation.tokenizerEncodeOptions);
  const tokenizer = generator.tokenizer as { encode?: (text: string) => unknown };
  let tokens: number | undefined;
  let method = "tokenizer unavailable";
  try {
    if (typeof tokenizer.encode === "function") {
      const ids = tokenizer.encode(renderedPrompt);
      if (Array.isArray(ids)) { tokens = ids.length; method = "tokenizer.encode(rendered prompt)"; }
    }
  } catch {
    method = "tokenizer encoding failed";
  }
  emit({ type: "TOKEN_COUNT", requestId: request.requestId,
    ...(tokens === undefined ? {} : { tokens }), renderedPrompt, method });
}

async function dispose(): Promise<void> {
  stoppingCriteria?.interrupt();
  activeRequestId = null;
  executionAbort?.abort();
  executionAbort = null;
  arcanai = null;
  await generator?.dispose();
  generator = null;
  candidate = null;
  stoppingCriteria = null;
  emit({ type: "DISPOSED" });
}

self.addEventListener("message", (event: MessageEvent<BenchmarkWorkerRequest>) => {
  const request = event.data;
  void (async () => {
    if (request.type === "INITIALIZE") await initialize(request.candidate);
    else if (request.type === "GENERATE") await generate(request);
    else if (request.type === "GENERATE_VISION") await generateVision(request);
    else if (request.type === "TOKENIZE") await tokenize(request);
    else if (request.type === "CANCEL") {
      if (activeRequestId === request.requestId) { activeRequestId = null; executionAbort?.abort(); stoppingCriteria?.interrupt(); }
    } else if (request.type === "DISPOSE") await dispose();
    else if (request.type === "CLEAR_CACHE") {
      if (generator) throw new Error("Dispose the model before clearing its cache.");
      if ("caches" in self) await caches.delete(cacheKey(request.candidateId));
      emit({ type: "CACHE_CLEARED" });
    }
  })().catch((error) => emit({ type: "ERROR", operation: request.type, message: boundedError(error),
    ...((request.type === "GENERATE" || request.type === "GENERATE_VISION" || request.type === "TOKENIZE") ? { requestId: request.requestId } : {}) }));
});
