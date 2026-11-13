import type { GenerationResult, ModelMessage, GenerationSettings } from "../types";
import { contextUsage, estimatedTokens, type CharacterLabSettings } from "./memory";

export interface TraceEvent {
  readonly timestamp: string;
  readonly phase: string;
  readonly detail: string;
  readonly durationMs?: number;
}
export interface RequestEvidence {
  readonly id: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly kind: "dialogue" | "summary";
  readonly model: string;
  readonly messages: readonly ModelMessage[];
  readonly renderedPrompt?: string;
  readonly tokenizerPromptTokens?: number;
  readonly tokenizerMethod: string;
  readonly promptEstimate: ReturnType<typeof contextUsage>;
  readonly requestedSettings: CharacterLabSettings;
  readonly appliedGenerationSettings?: GenerationSettings;
  readonly output: string;
  readonly outputTokens: number;
  readonly firstTokenMs?: number;
  readonly generationMs: number;
  readonly tokensPerSecond: number;
  readonly termination: string;
  readonly events: readonly TraceEvent[];
}

export function requestEvidence(input: {
  id: string; kind: "dialogue" | "summary"; model: string; startedAt: string;
  messages: readonly ModelMessage[]; settings: CharacterLabSettings;
  result: GenerationResult;
  tokenizer?: { tokens?: number; renderedPrompt?: string; method: string };
  events: readonly TraceEvent[];
}): RequestEvidence {
  const { result, tokenizer } = input;
  return {
    id: input.id, kind: input.kind, model: input.model, startedAt: input.startedAt,
    completedAt: new Date().toISOString(), messages: input.messages,
    ...(tokenizer?.renderedPrompt === undefined ? {} : { renderedPrompt: tokenizer.renderedPrompt }),
    ...(tokenizer?.tokens === undefined ? {} : { tokenizerPromptTokens: tokenizer.tokens }),
    tokenizerMethod: tokenizer?.method ?? "unavailable",
    promptEstimate: contextUsage(input.messages, input.settings),
    requestedSettings: { ...input.settings },
    ...(result.invocation?.settings === undefined ? {} : { appliedGenerationSettings: result.invocation.settings }),
    output: result.final, outputTokens: result.metrics.generatedTokens,
    ...(result.metrics.firstTokenMs === undefined ? {} : { firstTokenMs: result.metrics.firstTokenMs }),
    generationMs: result.metrics.generationMs, tokensPerSecond: result.metrics.tokensPerSecond,
    termination: result.metrics.termination, events: [...input.events],
  };
}
export function estimateRoleTokens(messages: readonly ModelMessage[]): number {
  return messages.filter(m => m.role === "system").reduce((sum,m) => sum + estimatedTokens(m.content),0);
}
export function estimateSummaryTokens(messages: readonly ModelMessage[]): number {
  return messages.filter(m => m.content.startsWith("PRIOR CONVERSATION SUMMARY")).reduce((sum,m) => sum + estimatedTokens(m.content),0);
}
export function validateContextBudget(messages: readonly ModelMessage[], settings: CharacterLabSettings): void {
  const usage = contextUsage(messages, settings);
  if (estimateRoleTokens(messages) > settings.roleBudget) throw new Error("Character contract exceeds role allocation.");
  if (estimateSummaryTokens(messages) > settings.summaryBudget) throw new Error("Memory summary exceeds summary allocation.");
  if (usage.remainingEstimated < 0) throw new Error("Estimated prompt and output exceed context target.");
}
