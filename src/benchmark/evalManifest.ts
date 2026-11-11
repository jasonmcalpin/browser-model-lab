import type { BenchmarkReasoningBudget, EvalCaseDescriptor, EvalManifest } from "./types";

export const BROWSER_AI_SCORER_REVISION = "browser-ai-scorers-v2";
export const BROWSER_AI_COMPATIBILITY_SPEC = "docs/BROWSER-AI-MODEL-COMPATIBILITY-SPECS.md";

export const BROWSER_AI_CASES: readonly EvalCaseDescriptor[] = [
  { id: "PF1", tags: ["production", "context", "grounding", "single-turn"], scorerRevision: BROWSER_AI_SCORER_REVISION },
  { id: "PF2", tags: ["production", "evidence", "provenance", "single-turn"], scorerRevision: BROWSER_AI_SCORER_REVISION },
  { id: "PF3", tags: ["production", "skills", "procedure", "single-turn"], scorerRevision: BROWSER_AI_SCORER_REVISION },
  { id: "PF4", tags: ["production", "tools", "authority-boundary", "structured-output"], scorerRevision: BROWSER_AI_SCORER_REVISION },
  { id: "PF5", tags: ["production", "loops", "state", "authority-boundary"], scorerRevision: BROWSER_AI_SCORER_REVISION },
  { id: "PF6", tags: ["production", "role", "privacy", "context-isolation", "multi-turn"], scorerRevision: BROWSER_AI_SCORER_REVISION },
  { id: "PF7", tags: ["production", "verification", "authority-boundary"], scorerRevision: BROWSER_AI_SCORER_REVISION },
  { id: "PF8", tags: ["production", "identity", "memory", "runtime-substitution"], scorerRevision: BROWSER_AI_SCORER_REVISION },
  { id: "PF9A", tags: ["production", "identity", "provenance", "origin"], scorerRevision: BROWSER_AI_SCORER_REVISION },
  { id: "PF9B", tags: ["production", "identity", "census", "uncertainty"], scorerRevision: BROWSER_AI_SCORER_REVISION },
  { id: "PF10", tags: ["production", "continuity", "policy", "player-facing"], scorerRevision: BROWSER_AI_SCORER_REVISION },
  { id: "PF11", tags: ["production", "character", "identity", "relationship", "overwrite-resistance"], scorerRevision: BROWSER_AI_SCORER_REVISION },
  { id: "PF11B", tags: ["production", "character", "multi-turn", "human-review", "unscored"], scorerRevision: BROWSER_AI_SCORER_REVISION },
  { id: "G1", tags: ["advanced", "direct", "format"], scorerRevision: BROWSER_AI_SCORER_REVISION },
  { id: "G2", tags: ["advanced", "tools", "structured-output"], scorerRevision: BROWSER_AI_SCORER_REVISION },
  { id: "G3", tags: ["advanced", "evidence", "injection-resistance"], scorerRevision: BROWSER_AI_SCORER_REVISION },
  { id: "T1", tags: ["advanced", "tools", "trajectory", "stop-condition"], scorerRevision: BROWSER_AI_SCORER_REVISION },
  { id: "T2", tags: ["advanced", "tools", "research", "multi-step"], scorerRevision: BROWSER_AI_SCORER_REVISION },
  { id: "IC1", tags: ["diagnostic", "instruction-contract", "structured-output", "unscored"], scorerRevision: BROWSER_AI_SCORER_REVISION },
  { id: "IC2", tags: ["diagnostic", "instruction-contract", "format-sensitivity", "unscored"], scorerRevision: BROWSER_AI_SCORER_REVISION },
  { id: "T3", tags: ["diagnostic", "tools", "no-applicable-tool", "unscored"], scorerRevision: BROWSER_AI_SCORER_REVISION },
  { id: "T4", tags: ["diagnostic", "tools", "missing-parameter", "unscored"], scorerRevision: BROWSER_AI_SCORER_REVISION },
  { id: "T5", tags: ["diagnostic", "tools", "selection", "authorization", "unscored"], scorerRevision: BROWSER_AI_SCORER_REVISION },
  { id: "T6", tags: ["diagnostic", "tools", "parallel-opportunity", "unscored"], scorerRevision: BROWSER_AI_SCORER_REVISION },
  { id: "A1", tags: ["diagnostic", "agent", "policy-persistence", "unscored"], scorerRevision: BROWSER_AI_SCORER_REVISION },
  { id: "A2", tags: ["diagnostic", "agent", "recovery", "unscored"], scorerRevision: BROWSER_AI_SCORER_REVISION },
  { id: "A3", tags: ["diagnostic", "security", "authority-hierarchy", "injection-resistance", "unscored"], scorerRevision: BROWSER_AI_SCORER_REVISION },
  { id: "P1", tags: ["diagnostic", "persona", "enactment", "voice-distinction", "unscored"], scorerRevision: BROWSER_AI_SCORER_REVISION },
  { id: "V1", tags: ["vision", "ocr", "game-artifact", "multimodal"], scorerRevision: BROWSER_AI_SCORER_REVISION },
  { id: "V2", tags: ["vision", "layout", "game-artifact", "multimodal"], scorerRevision: BROWSER_AI_SCORER_REVISION },
  ...Array.from({ length: 8 }, (_, index): EvalCaseDescriptor => ({
    id: `B${index + 1}`, tags: ["advanced", "quality"], scorerRevision: BROWSER_AI_SCORER_REVISION,
  })),
];

export function buildEvalManifest(input: {
  readonly benchmarkRevision: string;
  readonly candidateIds: readonly string[];
  readonly selectedTests: readonly string[];
  readonly reasoningBudgets: readonly BenchmarkReasoningBudget[];
}): EvalManifest {
  return {
    manifestVersion: 1,
    benchmarkRevision: input.benchmarkRevision,
    scorerRevision: BROWSER_AI_SCORER_REVISION,
    compatibilitySpec: BROWSER_AI_COMPATIBILITY_SPEC,
    candidateIds: input.candidateIds,
    selectedTests: input.selectedTests,
    reasoningBudgets: input.reasoningBudgets,
    trialPolicy: { deterministic: 1, sampled: 3, aggregation: "median", passPolicy: "majority" },
    cases: BROWSER_AI_CASES,
  };
}
