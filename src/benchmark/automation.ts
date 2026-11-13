import { BROWSER_AI_BENCHMARK_CANDIDATES, DEFAULT_BROWSER_AI_CANDIDATE_ID } from "./candidates";
import { parseBrowserModelCard } from "./modelCards";
import { BENCHMARK_REASONING_BUDGETS } from "./benchmarkRunner";
import { parseVisionFixtures } from "./visionFixtures";
import type { BrowserAiBenchmarkArtifact, BrowserAiBenchmarkAutomationConfig,
  BrowserAiBenchmarkAutomationState, BrowserAiBenchmarkCacheMode, BrowserAiBenchmarkTest,
  BenchmarkReasoningBudget, CandidateBenchmarkResult, LiveWikipediaSmokeResult,
  WebGpuCapabilities, BrowserModelCandidate } from "./types";

const TESTS = new Set<BrowserAiBenchmarkTest>(["production", "advanced", "t1", "t2", "vision", "all"]);
const CACHE_MODES = new Set<BrowserAiBenchmarkCacheMode>(["cold", "cached"]);

export interface ParsedBrowserAiAutomationQuery {
  readonly autorun: boolean;
  readonly config: BrowserAiBenchmarkAutomationConfig;
  readonly candidateOverride?: BrowserModelCandidate;
}

export interface BenchmarkExecutionPlan {
  readonly production: boolean;
  readonly advanced: boolean;
  readonly t1Only: boolean;
  readonly t2Only: boolean;
  readonly visionOnly?: boolean;
  readonly budgets: readonly BenchmarkReasoningBudget[];
}

function oneOf<T extends string>(value: string, values: ReadonlySet<T>, label: string): T {
  if (!values.has(value as T)) throw new Error(`Invalid ${label}: ${value}`);
  return value as T;
}

function parseBudget(value: string | null): readonly BenchmarkReasoningBudget[] {
  if (value === null || value === "all") return BENCHMARK_REASONING_BUDGETS;
  if (value === "256" || value === "512" || value === "768") return [Number(value) as BenchmarkReasoningBudget];
  throw new Error(`Invalid budget: ${value}`);
}

function parseCacheMode(parameters: URLSearchParams): BrowserAiBenchmarkCacheMode {
  const explicit = parameters.get("cache");
  const cold = parameters.get("cold") === "1";
  const cached = parameters.get("cached") === "1";
  if ((cold && cached) || (explicit && (cold || cached))) throw new Error("Choose exactly one cache mode.");
  if (explicit) return oneOf(explicit, CACHE_MODES, "cache mode");
  if (cached) return "cached";
  return "cold";
}

export function parseBrowserAiAutomationQuery(search: string,
  candidateIds: readonly string[] = BROWSER_AI_BENCHMARK_CANDIDATES.map((candidate) => candidate.id),
): ParsedBrowserAiAutomationQuery {
  const parameters = new URLSearchParams(search);
  const encodedCard = parameters.get("model-card");
  const candidateOverride = encodedCard === null ? undefined
    : parseBrowserModelCard(JSON.parse(encodedCard), "automation model card").candidate;
  const requestedCandidate = parameters.get("candidate") ?? candidateOverride?.id ?? DEFAULT_BROWSER_AI_CANDIDATE_ID;
  if (candidateOverride && requestedCandidate !== candidateOverride.id)
    throw new Error("Automation candidate does not match supplied model card.");
  const availableCandidateIds = candidateOverride ? [candidateOverride.id] : candidateIds;
  const selectedCandidateIds = requestedCandidate === "all" ? availableCandidateIds : [requestedCandidate];
  for (const candidateId of selectedCandidateIds)
    if (!availableCandidateIds.includes(candidateId)) throw new Error(`Unknown benchmark candidate: ${candidateId}`);

  const test = oneOf(parameters.get("test") ?? "all", TESTS, "test");
  const machine = parameters.get("machine") ?? "unlabeled";
  if (!/^[A-Za-z0-9._-]{1,80}$/.test(machine)) throw new Error(`Invalid machine label: ${machine}`);
  const benchmarkRevision = parameters.get("revision") ?? "uncommitted-browser-session";
  if (!/^[A-Za-z0-9._-]{1,100}$/.test(benchmarkRevision))
    throw new Error(`Invalid benchmark revision: ${benchmarkRevision}`);
  const liveWikipedia = parameters.get("live-wikipedia") === "1";
  if (liveWikipedia && selectedCandidateIds.length !== 1)
    throw new Error("Live Wikipedia smoke requires exactly one candidate.");

  return {
    autorun: parameters.get("autorun") === "1",
    ...(candidateOverride ? { candidateOverride } : {}),
    config: {
      candidateIds: selectedCandidateIds,
      test,
      budgets: parseBudget(parameters.get("budget")),
      cacheMode: parseCacheMode(parameters),
      machine,
      benchmarkRevision,
      liveWikipedia,
      ...(parameters.has("vision-cases") ? { visionFixtures: parseVisionFixtures(JSON.parse(parameters.get("vision-cases")!)) } : {}),
    },
  };
}

export function benchmarkExecutionPlan(config: Pick<BrowserAiBenchmarkAutomationConfig, "test" | "budgets">):
BenchmarkExecutionPlan {
  return {
    production: config.test === "production" || config.test === "all",
    advanced: config.test === "advanced" || config.test === "all",
    t1Only: config.test === "t1",
    t2Only: config.test === "t2",
    visionOnly: config.test === "vision",
    budgets: config.test === "production" ? [] : config.budgets,
  };
}

export interface BrowserAiAutomationDependencies {
  readonly publish: (state: BrowserAiBenchmarkAutomationState) => void;
  readonly probeWebGpu: () => Promise<WebGpuCapabilities>;
  readonly runCandidate: (candidateId: string, progress: (detail: string) => void,
    capabilities: WebGpuCapabilities) =>
    Promise<CandidateBenchmarkResult>;
  readonly runLiveWikipedia: (candidateId: string, progress: (detail: string) => void) =>
    Promise<LiveWikipediaSmokeResult>;
  readonly buildArtifact: (results: readonly CandidateBenchmarkResult[], capabilities: WebGpuCapabilities,
    liveWikipediaSmoke?: LiveWikipediaSmokeResult) => BrowserAiBenchmarkArtifact;
}

export async function executeBrowserAiAutomation(config: BrowserAiBenchmarkAutomationConfig,
  dependencies: BrowserAiAutomationDependencies): Promise<BrowserAiBenchmarkAutomationState> {
  const running = (detail: string): void =>
    dependencies.publish({ status: "running", config, detail });
  running("Probing WebGPU capabilities.");
  try {
    const capabilities = await dependencies.probeWebGpu();
    const results: CandidateBenchmarkResult[] = [];
    for (const candidateId of config.candidateIds) {
      running(`Running ${candidateId}.`);
      results.push(await dependencies.runCandidate(candidateId, running, capabilities));
    }
    const liveWikipediaSmoke = config.liveWikipedia
      ? await dependencies.runLiveWikipedia(config.candidateIds[0]!, running)
      : undefined;
    const state: BrowserAiBenchmarkAutomationState = {
      status: "complete",
      config,
      artifact: dependencies.buildArtifact(results, capabilities, liveWikipediaSmoke),
    };
    dependencies.publish(state);
    return state;
  } catch (error) {
    const state: BrowserAiBenchmarkAutomationState = {
      status: "failed",
      config,
      error: error instanceof Error ? error.message : String(error),
    };
    dependencies.publish(state);
    return state;
  }
}
