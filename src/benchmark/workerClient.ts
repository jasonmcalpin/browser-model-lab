import { buildModelInvocation, buildVisionInvocation, parseAdapterOutput } from "./modelAdapters";
import type { BenchmarkRuntimeClient, RuntimeProgressListener } from "./runtimeClient";
import type { BenchmarkWorkerRequest, BenchmarkWorkerResponse, BrowserModelCandidate, CanonicalGenerationRequest,
  GenerationResult, InitializationMetrics, ModelInvocation, VisionGenerationResult, VisionInvocation } from "./types";

export class BenchmarkWorkerClient implements BenchmarkRuntimeClient {
  private readonly worker: Worker;
  private requestSequence = 0;
  private candidate: BrowserModelCandidate | undefined;
  private pendingInit: { resolve(value: InitializationMetrics): void; reject(error: Error): void } | undefined;
  private pendingAction: { kind: "dispose" | "cache"; resolve(): void; reject(error: Error): void } | undefined;
  private pendingGeneration: { requestId: string; invocation: ModelInvocation;
    resolve(value: GenerationResult): void; reject(error: Error): void } | undefined;
  private pendingTokenize: { requestId: string; resolve(value: { tokens?: number; renderedPrompt?: string; method: string }): void; reject(error: Error): void } | undefined;
  private pendingVision: { requestId: string; invocation: VisionInvocation;
    resolve(value: VisionGenerationResult): void; reject(error: Error): void } | undefined;

  constructor(private readonly onProgress: RuntimeProgressListener = () => undefined) {
    this.worker = new Worker(new URL("./benchmark.worker.ts", import.meta.url), { type: "module", name: "browser-ai-benchmark-v2" });
    this.worker.addEventListener("message", this.handleMessage);
  }

  initialize(candidate: BrowserModelCandidate): Promise<InitializationMetrics> {
    this.candidate = candidate;
    return new Promise((resolve, reject) => {
      this.pendingInit = { resolve, reject };
      this.send({ type: "INITIALIZE", candidate });
    });
  }

  generate(request: CanonicalGenerationRequest): Promise<GenerationResult> {
    if (!this.candidate) return Promise.reject(new Error("Benchmark model is not initialized."));
    const requestId = `benchmark-generation-${++this.requestSequence}`;
    const invocation = buildModelInvocation(this.candidate, request);
    return new Promise((resolve, reject) => {
      this.pendingGeneration = { requestId, invocation, resolve, reject };
      this.send({ type: "GENERATE", requestId, invocation });
    });
  }

  generateVision(imageUrl: string, prompt: string, maxNewTokens = 96): Promise<VisionGenerationResult> {
    if (!this.candidate) return Promise.reject(new Error("Benchmark model is not initialized."));
    const requestId = `benchmark-vision-${++this.requestSequence}`;
    let invocation: VisionInvocation;
    try { invocation = buildVisionInvocation(this.candidate, imageUrl, prompt, maxNewTokens); }
    catch (error) { return Promise.reject(error); }
    return new Promise((resolve, reject) => {
      this.pendingVision = { requestId, invocation, resolve, reject };
      this.send({ type: "GENERATE_VISION", requestId, invocation });
    });
  }

  tokenize(request: CanonicalGenerationRequest): Promise<{ tokens?: number; renderedPrompt?: string; method: string }> {
    if (!this.candidate) return Promise.reject(new Error("Benchmark model is not initialized."));
    const requestId = `benchmark-tokenize-${++this.requestSequence}`;
    const invocation = buildModelInvocation(this.candidate, request);
    return new Promise((resolve, reject) => {
      this.pendingTokenize = { requestId, resolve, reject };
      this.send({ type: "TOKENIZE", requestId, invocation });
    });
  }

  cancel(): void {
    if (this.pendingGeneration) this.send({ type: "CANCEL", requestId: this.pendingGeneration.requestId });
    if (this.pendingVision) this.send({ type: "CANCEL", requestId: this.pendingVision.requestId });
  }

  disposeModel(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.pendingAction = { kind: "dispose", resolve, reject };
      this.send({ type: "DISPOSE" });
    });
  }

  clearCache(candidateId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.pendingAction = { kind: "cache", resolve, reject };
      this.send({ type: "CLEAR_CACHE", candidateId });
    });
  }

  terminate(): void {
    this.worker.removeEventListener("message", this.handleMessage);
    this.worker.terminate();
  }

  private send(message: BenchmarkWorkerRequest): void { this.worker.postMessage(message); }

  private readonly handleMessage = (event: MessageEvent<BenchmarkWorkerResponse>) => {
    const message = event.data;
    if (message.type === "PROGRESS") this.onProgress(message.phase, message.detail);
    else if (message.type === "TOKEN_COUNT" && this.pendingTokenize?.requestId === message.requestId) {
      this.pendingTokenize.resolve({
        ...(message.tokens === undefined ? {} : { tokens: message.tokens }),
        ...(message.renderedPrompt === undefined ? {} : { renderedPrompt: message.renderedPrompt }),
        method: message.method,
      });
      this.pendingTokenize = undefined;
    }
    else if (message.type === "READY") { this.pendingInit?.resolve(message.metrics); this.pendingInit = undefined; }
    else if (message.type === "COMPLETE" && this.pendingVision?.requestId === message.requestId) {
      this.pendingVision.resolve({ raw: message.raw, final: message.raw.trim(), metrics: message.metrics,
        invocation: this.pendingVision.invocation });
      this.pendingVision = undefined;
    } else if (message.type === "COMPLETE" && this.pendingGeneration?.requestId === message.requestId) {
      const extracted = parseAdapterOutput(this.candidate!, message.raw);
      this.pendingGeneration.resolve({ raw: message.raw, final: extracted.final,
        metrics: { ...message.metrics, ...(extracted.reasoningTokens === undefined ? {} : { reasoningTokens: extracted.reasoningTokens }) },
        invocation: this.pendingGeneration.invocation, ...(extracted.turn ? { turn: extracted.turn } : {}) });
      this.pendingGeneration = undefined;
    } else if (message.type === "CANCELLED" && this.pendingVision?.requestId === message.requestId) {
      this.pendingVision.reject(new Error("Generation cancelled."));
      this.pendingVision = undefined;
    } else if (message.type === "CANCELLED" && this.pendingGeneration?.requestId === message.requestId) {
      this.pendingGeneration.reject(new Error("Generation cancelled."));
      this.pendingGeneration = undefined;
    } else if (message.type === "DISPOSED" && this.pendingAction?.kind === "dispose") {
      this.pendingAction.resolve(); this.pendingAction = undefined;
    } else if (message.type === "CACHE_CLEARED" && this.pendingAction?.kind === "cache") {
      this.pendingAction.resolve(); this.pendingAction = undefined;
    } else if (message.type === "ERROR") {
      const error = new Error(`${message.operation}: ${message.message}`);
      if (message.requestId && this.pendingTokenize?.requestId === message.requestId) {
        this.pendingTokenize.reject(error); this.pendingTokenize = undefined;
      } else if (message.requestId && this.pendingVision?.requestId === message.requestId) {
        this.pendingVision.reject(error); this.pendingVision = undefined;
      } else if (message.requestId && this.pendingGeneration?.requestId === message.requestId) {
        this.pendingGeneration.reject(error); this.pendingGeneration = undefined;
      } else if (this.pendingInit) { this.pendingInit.reject(error); this.pendingInit = undefined; }
      else if (this.pendingAction) { this.pendingAction.reject(error); this.pendingAction = undefined; }
    }
  };
}
