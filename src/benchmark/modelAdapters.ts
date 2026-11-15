import { prepareModelInvocation, prepareVisionInvocation, parseModelOutput } from "arcanai/plugins/transformersjs";
import { compatibilityProfileFor, resolveGenerationProfile } from "./compatibilityProfiles";
import type { AdapterProfileReport, BrowserModelCandidate, CanonicalGenerationRequest, ModelInvocation,
  ModelTurn, VisionInvocation } from "./types";

/**
 * Benchmark projections live in BML. Model-specific prompt/tool/reasoning
 * interpretation and output parsing belong to ArcanAI and are shared with Aether.
 */
export function adapterReport(candidate: BrowserModelCandidate): AdapterProfileReport {
  const profile = compatibilityProfileFor(candidate);
  return {
    adapterId: profile.adapterId,
    promptPlacement: profile.chat.promptPlacement,
    toolCallFormat: profile.tools.callFormat,
    reasoningFormat: profile.reasoning.control === "forced-think-prefix" ? "think-tags" : "none",
    runtimeKind: profile.runtime.kind,
    toolSupportMode: profile.tools.mode,
    compatibilityProfileId: profile.id,
    ...(profile.reasoning.control === "enable_thinking" ? { tokenizerOptions: {
      enable_thinking: profile.reasoning.enabledForBenchmark ?? false,
      ...(profile.tools.tokenizerTools ? { tools: "native tool schemas supplied through tokenizer encode kwargs" } : {}),
    } } : {}),
    profiles: {
      production: resolveGenerationProfile(profile.profiles.production),
      direct: resolveGenerationProfile(profile.profiles.direct),
      tool: resolveGenerationProfile(profile.profiles.tool),
    },
    ...(profile.visionProfile ? { visionProfile: resolveGenerationProfile(profile.visionProfile) } : {}),
  };
}


export function buildVisionInvocation(candidate: BrowserModelCandidate, imageUrl: string,
  prompt: string, maxNewTokens = 96): VisionInvocation {
  return prepareVisionInvocation(candidate, imageUrl, prompt, maxNewTokens) as VisionInvocation;
}

export function buildModelInvocation(candidate: BrowserModelCandidate,
  request: CanonicalGenerationRequest): ModelInvocation {
  return prepareModelInvocation(candidate, request) as ModelInvocation;
}

export function parseAdapterOutput(candidate: BrowserModelCandidate, raw: string): {
  readonly final: string; readonly reasoningTokens?: number; readonly turn?: ModelTurn;
} {
  return parseModelOutput(candidate, raw) as {
    readonly final: string; readonly reasoningTokens?: number; readonly turn?: ModelTurn;
  };
}
