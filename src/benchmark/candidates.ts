import type { BrowserModelCandidate } from "./types";
import { compatibilityProfileFor } from "./compatibilityProfiles";
import { BROWSER_MODEL_CARDS, DEFAULT_BROWSER_AI_CANDIDATE_ID } from "./modelCards";

export const BROWSER_AI_BENCHMARK_CANDIDATES: readonly BrowserModelCandidate[] =
  BROWSER_MODEL_CARDS.map((card) => card.candidate);

export { DEFAULT_BROWSER_AI_CANDIDATE_ID };

export function candidateById(id: string): BrowserModelCandidate {
  const candidate = BROWSER_AI_BENCHMARK_CANDIDATES.find((entry) => entry.id === id);
  if (!candidate) throw new Error(`Unknown benchmark candidate: ${id}`);
  return candidate;
}

export function validateCandidateRegistry(candidates: readonly BrowserModelCandidate[]): void {
  const ids = new Set<string>();
  for (const candidate of candidates) {
    if (!candidate.id || ids.has(candidate.id)) throw new Error(`Duplicate or empty candidate id: ${candidate.id}`);
    if (!/^[\w.-]+\/[\w.-]+$/.test(candidate.modelId) || !candidate.revision)
      throw new Error(`Invalid candidate artifact: ${candidate.id}`);
    if (candidate.backend !== "webgpu" || !["q4f16", "q4", "q8", "mixed"].includes(candidate.dtype))
      throw new Error(`Unsupported benchmark runtime: ${candidate.id}`);
    if (!["text-generation", "direct-model"].includes(candidate.pipelineTask))
      throw new Error(`Unsupported benchmark pipeline: ${candidate.id}`);
    const profile = compatibilityProfileFor(candidate);
    if (profile.runtime.kind !== "pipeline" && profile.runtime.kind !== "direct-model")
      throw new Error(`Unsupported embedded runtime kind: ${candidate.id}`);
    ids.add(candidate.id);
  }
}

validateCandidateRegistry(BROWSER_AI_BENCHMARK_CANDIDATES);
