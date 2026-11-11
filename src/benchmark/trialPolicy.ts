import { compatibilityProfileFor } from "./compatibilityProfiles";
import type { BenchmarkWorkload, BrowserModelCandidate, EvalEvent, GenerationResult, ResultValidity,
  TaskRuntimeMetrics, TrialAttempt, TrialSummary } from "./types";

function numericMedian(values: readonly number[]): number {
  if (!values.length) return 0;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle]! : (ordered[middle - 1]! + ordered[middle]!) / 2;
}

export function trialCountFor(candidate: BrowserModelCandidate, workload: BenchmarkWorkload): 1 | 3 {
  return compatibilityProfileFor(candidate).profiles[workload].doSample ? 3 : 1;
}

export function resultValidity(generations: readonly GenerationResult[], passed: boolean,
  adapterConformant = true): ResultValidity {
  if (!adapterConformant) return "INVALID_INTEGRATION";
  return !passed && generations.some((generation) => generation.metrics.termination === "TOKEN_LIMIT")
    ? "CONSTRAINED" : "VALID";
}

export function generationEvents(generations: readonly GenerationResult[]): EvalEvent[] {
  const events: EvalEvent[] = [];
  let sequence = 0;
  for (const generation of generations) {
    if (generation.invocation) events.push({ sequence: ++sequence, type: "invocation", data: generation.invocation });
    events.push({ sequence: ++sequence, type: "model-output", data: {
      raw: generation.raw, final: generation.final, metrics: generation.metrics,
    } });
    if (generation.turn) events.push({ sequence: ++sequence, type: "normalized-turn", data: generation.turn });
  }
  return events;
}

export function trialAttempt(index: number, passed: boolean, score: number,
  generations: readonly GenerationResult[], endToEndMs: number, adapterConformant = true,
  additionalEvents: readonly EvalEvent[] = []): TrialAttempt {
  const firstTokenValues = generations.flatMap((generation) =>
    generation.metrics.firstTokenMs === undefined ? [] : [generation.metrics.firstTokenMs]);
  return {
    index, passed, score,
    rawOutputs: generations.map((generation) => generation.raw),
    normalizedTurns: generations.flatMap((generation) => generation.turn ? [generation.turn] : []),
    generatedTokens: generations.reduce((sum, generation) => sum + generation.metrics.generatedTokens, 0),
    ...(firstTokenValues.length ? { ttftMs: firstTokenValues[0] } : {}),
    modelMs: generations.reduce((sum, generation) => sum + generation.metrics.generationMs, 0),
    endToEndMs,
    validity: resultValidity(generations, passed, adapterConformant),
    terminations: generations.map((generation) => generation.metrics.termination),
    renderedInvocations: generations.flatMap((generation) => generation.invocation ? [generation.invocation] : []),
    events: additionalEvents.length ? additionalEvents : generationEvents(generations),
  };
}

export function buildTrialSummary(attempts: readonly TrialAttempt[]): TrialSummary {
  if (!attempts.length) throw new Error("A trial summary requires at least one attempt.");
  const ttfts = attempts.flatMap((attempt) => attempt.ttftMs === undefined ? [] : [attempt.ttftMs]);
  return {
    attemptCount: attempts.length,
    passCount: attempts.filter((attempt) => attempt.passed).length,
    medianScore: numericMedian(attempts.map((attempt) => attempt.score)),
    minimumScore: Math.min(...attempts.map((attempt) => attempt.score)),
    maximumScore: Math.max(...attempts.map((attempt) => attempt.score)),
    medianGeneratedTokens: numericMedian(attempts.map((attempt) => attempt.generatedTokens)),
    ...(ttfts.length ? { medianTtftMs: numericMedian(ttfts) } : {}),
    medianModelMs: numericMedian(attempts.map((attempt) => attempt.modelMs)),
    medianEndToEndMs: numericMedian(attempts.map((attempt) => attempt.endToEndMs)),
    attempts,
  };
}

export function representativeIndex(attempts: readonly TrialAttempt[]): number {
  const summary = buildTrialSummary(attempts);
  const medianScore = summary.medianScore;
  return attempts.findIndex((attempt) => attempt.score === medianScore);
}

export function medianTaskMetrics(metrics: readonly TaskRuntimeMetrics[]): TaskRuntimeMetrics {
  if (!metrics.length) throw new Error("Task metrics require at least one trial.");
  const optionalMedian = (values: readonly (number | undefined)[]) => {
    const present = values.flatMap((value) => value === undefined ? [] : [value]);
    return present.length ? numericMedian(present) : undefined;
  };
  const tokensToFirstValidToolCall = optionalMedian(metrics.map((entry) => entry.tokensToFirstValidToolCall));
  const tokensToFinalAnswer = optionalMedian(metrics.map((entry) => entry.tokensToFinalAnswer));
  const ttftMs = optionalMedian(metrics.map((entry) => entry.ttftMs));
  return {
    reachedValidToolCall: metrics.filter((entry) => entry.reachedValidToolCall).length >= Math.ceil(metrics.length / 2),
    reachedFinalAnswer: metrics.filter((entry) => entry.reachedFinalAnswer).length >= Math.ceil(metrics.length / 2),
    ...(tokensToFirstValidToolCall === undefined ? {} : { tokensToFirstValidToolCall }),
    ...(tokensToFinalAnswer === undefined ? {} : { tokensToFinalAnswer }),
    totalGeneratedTokens: numericMedian(metrics.map((entry) => entry.totalGeneratedTokens)),
    ...(ttftMs === undefined ? {} : { ttftMs }),
    modelMs: numericMedian(metrics.map((entry) => entry.modelMs)),
    toolMs: numericMedian(metrics.map((entry) => entry.toolMs)),
    endToEndMs: numericMedian(metrics.map((entry) => entry.endToEndMs)),
  };
}

export function aggregateValidity(attempts: readonly TrialAttempt[]): ResultValidity {
  if (attempts.some((attempt) => attempt.validity === "INVALID_INTEGRATION")) return "INVALID_INTEGRATION";
  if (attempts.every((attempt) => attempt.validity === "RUNTIME_BLOCKED")) return "RUNTIME_BLOCKED";
  if (attempts.every((attempt) => attempt.validity === "UNMEASURED")) return "UNMEASURED";
  if (attempts.some((attempt) => attempt.validity === "CONSTRAINED")) return "CONSTRAINED";
  return "VALID";
}
