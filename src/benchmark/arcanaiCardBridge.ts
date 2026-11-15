import type { BrowserModelCandidate, ModelInvocation } from "./types";

/**
 * Temporary migration boundary. BML v3 remains authoritative for historical
 * benchmarking until the ArcanAI card migration is validated. This converts
 * an already prepared BML invocation into ArcanAI's canonical v1 execution
 * card, preserving per-model profile settings and tokenizer kwargs unchanged.
 */
export function arcanaiCardForInvocation(candidate: BrowserModelCandidate, invocation: ModelInvocation) {
  const s = invocation.settings;
  return {
    schemaVersion: "1.0" as const,
    id: candidate.id,
    execution: {
      plugin: "@arcanai/plugin-transformersjs",
      instance: candidate.id,
      model: candidate.modelId,
      options: {
        maxTokens: s.maxNewTokens,
        ...(s.temperature === undefined ? {} : { temperature: s.temperature }),
        ...(s.topP === undefined ? {} : { topP: s.topP })
      },
      providerOptions: {
        ...(s.doSample === undefined ? {} : { doSample: s.doSample }),
        ...(s.topK === undefined ? {} : { topK: s.topK }),
        ...(s.minP === undefined ? {} : { minP: s.minP }),
        ...(s.presencePenalty === undefined ? {} : { presencePenalty: s.presencePenalty }),
        ...(s.repetitionPenalty === undefined ? {} : { repetitionPenalty: s.repetitionPenalty }),
        ...(invocation.tokenizerEncodeOptions === undefined ? {} : {
          tokenizerEncodeOptions: invocation.tokenizerEncodeOptions
        })
      }
    }
  };
}
