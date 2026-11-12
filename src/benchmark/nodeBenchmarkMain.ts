import { buildBrowserAiBenchmarkArtifact } from "./artifact";
import { runCandidateBenchmark, runLiveWikipediaSmoke, BENCHMARK_REASONING_BUDGETS } from "./benchmarkRunner";
import { NodeBenchmarkRuntimeClient } from "./nodeRuntimeClient";
import { parseBrowserModelCard } from "./modelCards";
import type { BenchmarkReasoningBudget, BrowserAiBenchmarkArtifact, BrowserAiBenchmarkTest,
  BrowserModelCandidate, CandidateBenchmarkResult, LiveWikipediaSmokeResult } from "./types";

export interface NodeBenchmarkRunOptions {
  readonly cards: readonly unknown[];
  readonly candidate: string;
  readonly test: BrowserAiBenchmarkTest;
  readonly budget: "256" | "512" | "768" | "all";
  readonly machine: string;
  readonly benchmarkRevision: string;
  readonly liveWikipedia: boolean;
  readonly progress?: (message: string) => void;
}

function budgets(value: NodeBenchmarkRunOptions["budget"]): readonly BenchmarkReasoningBudget[] {
  if (value === "all") return BENCHMARK_REASONING_BUDGETS;
  return [Number(value) as BenchmarkReasoningBudget];
}

function plan(test: BrowserAiBenchmarkTest, selectedBudgets: readonly BenchmarkReasoningBudget[]) {
  return {
    production: test === "production" || test === "all",
    advanced: test === "advanced" || test === "all",
    t1Only: test === "t1",
    t2Only: test === "t2",
    budgets: test === "production" ? [] : selectedBudgets,
  };
}

export async function runNodeBenchmark(options: NodeBenchmarkRunOptions): Promise<BrowserAiBenchmarkArtifact> {
  const progress = options.progress ?? (() => undefined);
  const candidates: readonly BrowserModelCandidate[] = options.cards
    .map((card, index) => parseBrowserModelCard(card, `headless card ${index + 1}`).candidate);
  const selected = options.candidate === "all"
    ? candidates
    : candidates.filter((candidate) => candidate.id === options.candidate);
  if (!selected.length) throw new Error(`No headless benchmark candidate matched ${options.candidate}.`);
  if (options.liveWikipedia && selected.length !== 1)
    throw new Error("Live Wikipedia smoke requires exactly one candidate.");

  const selectedBudgets = budgets(options.budget);
  const executionPlan = plan(options.test, selectedBudgets);
  const results: CandidateBenchmarkResult[] = [];
  const clientFactory = (onProgress: (phase: string, detail?: string) => void) =>
    new NodeBenchmarkRuntimeClient(onProgress);
  const userAgent = `node/${process.version} ${process.platform}/${process.arch}`;

  for (const candidate of selected) {
    progress(`Running ${candidate.id} headlessly (${options.test}, budget ${options.budget}, cached)`);
    results.push(await runCandidateBenchmark(candidate, progress, {
      cold: false,
      plan: executionPlan,
      userAgent,
      vision: false,
      clientFactory,
    }));
  }

  let liveWikipediaSmoke: LiveWikipediaSmokeResult | undefined;
  if (options.liveWikipedia)
    liveWikipediaSmoke = await runLiveWikipediaSmoke(selected[0]!, progress, clientFactory);

  return buildBrowserAiBenchmarkArtifact(results, undefined, liveWikipediaSmoke, selectedBudgets, {
    machine: options.machine,
    benchmarkRevision: options.benchmarkRevision,
    selectedTests: [options.test],
    environment: { userAgent, webgpu: true },
  });
}
