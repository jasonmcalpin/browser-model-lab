import type { BrowserModelCandidate, CanonicalGenerationRequest, GenerationResult,
  InitializationMetrics, VisionGenerationResult } from "./types";

export type RuntimeProgressListener = (phase: string, detail?: string) => void;

export interface BenchmarkRuntimeClient {
  initialize(candidate: BrowserModelCandidate): Promise<InitializationMetrics>;
  generate(request: CanonicalGenerationRequest): Promise<GenerationResult>;
  generateVision(imageUrl: string, prompt: string, maxNewTokens?: number): Promise<VisionGenerationResult>;
  cancel(): void;
  disposeModel(): Promise<void>;
  clearCache(candidateId: string): Promise<void>;
  terminate(): void;
}
