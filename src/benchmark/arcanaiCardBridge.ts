import type { BrowserModelCandidate, ModelInvocation, VisionInvocation, GenerationSettings } from "./types";

/**
 * Versioned migration boundary for BML v3 cards.
 * ArcanAI is the owner of the canonical execution schema. This mapping is
 * temporary until BML inventories directly consume ArcanAI execution cards.
 */
export function arcanaiCardForCandidate(candidate: BrowserModelCandidate) {
  const profile = candidate.compatibilityProfile;
  const config = profile.runtime;
  return {
    schemaVersion: "1.0" as const,
    id: candidate.id,
    execution: {
      plugin: "@arcanai/plugin-transformersjs",
      instance: candidate.id,
      model: candidate.modelId,
      runtime: {
        kind: config.kind,
        dtype: config.dtype,
        revision: candidate.revision,
        device: "webgpu",
        ...(config.modelClass && config.modelClass !== "auto" ? { modelClass: config.modelClass } : {}),
        ...(config.processorClass && config.processorClass !== "auto" ? { processorClass: config.processorClass } : {}),
        renderer: profile.chat.renderer,
        ...(profile.chat.messageFormat ? { messageFormat: profile.chat.messageFormat } : {})
      }
    }
  };
}

function generationOptions(settings: GenerationSettings) {
  return {
    options: {
      maxTokens: settings.maxNewTokens,
      ...(settings.temperature === undefined ? {} : { temperature: settings.temperature }),
      ...(settings.topP === undefined ? {} : { topP: settings.topP })
    },
    providerOptions: {
      ...(settings.doSample === undefined ? {} : { doSample: settings.doSample }),
      ...(settings.topK === undefined ? {} : { topK: settings.topK }),
      ...(settings.minP === undefined ? {} : { minP: settings.minP }),
      ...(settings.presencePenalty === undefined ? {} : { presencePenalty: settings.presencePenalty }),
      ...(settings.repetitionPenalty === undefined ? {} : { repetitionPenalty: settings.repetitionPenalty })
    }
  };
}

export function arcanaiCardForInvocation(candidate: BrowserModelCandidate, invocation: ModelInvocation) {
  const base = arcanaiCardForCandidate(candidate);
  const resolved = generationOptions(invocation.settings);
  return {
    ...base,
    execution: {
      ...base.execution,
      ...resolved,
      providerOptions: {
        ...resolved.providerOptions,
        ...(invocation.tokenizerEncodeOptions === undefined ? {} : {
          tokenizerEncodeOptions: invocation.tokenizerEncodeOptions
        })
      }
    }
  };
}

export function arcanaiCardForVisionInvocation(candidate: BrowserModelCandidate, invocation: VisionInvocation) {
  const base = arcanaiCardForCandidate(candidate);
  return {
    ...base,
    execution: {
      ...base.execution,
      ...generationOptions(invocation.settings)
    }
  };
}
