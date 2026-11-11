import { useEffect, useMemo, useRef, useState } from "react";
import { buildBrowserAiBenchmarkArtifact } from "./artifact";
import { benchmarkExecutionPlan, executeBrowserAiAutomation, parseBrowserAiAutomationQuery,
  type ParsedBrowserAiAutomationQuery } from "./automation";
import { BROWSER_AI_BENCHMARK_CANDIDATES, candidateById } from "./candidates";
import { BENCHMARK_REASONING_BUDGETS, runCandidateBenchmark, runLiveWikipediaSmoke } from "./benchmarkRunner";
import { probeWebGpuCapabilities } from "./webGpuCapabilities";
import type { BrowserAiBenchmarkAutomationState, BudgetBenchmarkResult, CandidateBenchmarkResult,
  LiveWikipediaSmokeResult, WebGpuCapabilities } from "./types";
import "./browserAiBenchmark.css";

type AutomationRequest = { readonly parsed?: ParsedBrowserAiAutomationQuery; readonly error?: string };

function automationRequest(search: string): AutomationRequest {
  try { return { parsed: parseBrowserAiAutomationQuery(search) }; }
  catch (error) { return { error: error instanceof Error ? error.message : String(error) }; }
}

function formatMs(value?: number): string { return value === undefined ? "—" : `${(value / 1000).toFixed(2)} s`; }
function formatBytes(value?: number): string { return value === undefined ? "unobserved" : `${(value / 1024 / 1024).toFixed(1)} MiB`; }
function budgetSummary(budget: BudgetBenchmarkResult | undefined) {
  if (!budget) return <p>Not run.</p>;
  if (budget.status === "failed") return <p role="alert">Run failed: {budget.failure}</p>;
  return <dl>
    <div><dt>Gates</dt><dd>{budget.gates
      ? `G2:${budget.gates.g2.passed ? "PASS" : "FAIL"} · G3:${budget.gates.g3.passed ? "PASS" : "FAIL"}`
      : "not run"}</dd></div>
    <div><dt>T1 controlled relay</dt><dd>{budget.t1 ? budget.t1.passed ? "PASS" : "FAIL" : "not run"}</dd></div>
    <div><dt>T2 pinned Kant</dt><dd>{budget.t2 ? `${budget.t2.score}/20` : "not run"}</dd></div>
    <div><dt>Quality</dt><dd>{budget.qualityStatus === "complete" ? `${budget.qualityScore}/100` : "not qualified"}</dd></div>
    <div><dt>T1 first valid tool</dt><dd>{budget.t1?.metrics.tokensToFirstValidToolCall ?? "—"} tokens</dd></div>
    <div><dt>T2 final answer</dt><dd>{budget.t2?.metrics.tokensToFinalAnswer ?? "—"} tokens</dd></div>
    <div><dt>Total generated</dt><dd>{budget.totalGeneratedTokens} tokens</dd></div>
    <div><dt>Median TTFT</dt><dd>{formatMs(budget.medianTtftMs)}</dd></div>
    <div><dt>T2 model/tool/total</dt><dd>{formatMs(budget.t2?.metrics.modelMs)} / {formatMs(budget.t2?.metrics.toolMs)} / {formatMs(budget.t2?.metrics.endToEndMs)}</dd></div>
  </dl>;
}

function diagnosticsSummary(result: CandidateBenchmarkResult) {
  if (!result.diagnostics) return <p>Not run.</p>;
  return <>
    <div className="benchmark-axis-heading"><h3>Role diagnostics</h3>
      <strong>{result.diagnosticProbes?.cases.filter((entry) => entry.passed).length ?? 0}/
        {result.diagnosticProbes?.cases.length ?? 0} focused probes</strong></div>
    <dl>{result.diagnostics.roles.map((role) =>
      <div key={role.id}><dt>{role.id}</dt><dd>{role.rating} · {role.score}/{role.maximum}</dd></div>)}</dl>
    <details><summary>Failure diagnoses</summary><pre>{JSON.stringify(result.diagnostics.failures, null, 2)}</pre></details>
    {result.diagnosticProbes && <details><summary>Focused diagnostic probes</summary>
      <pre>{JSON.stringify(result.diagnosticProbes, null, 2)}</pre></details>}
  </>;
}

function productionSummary(result: CandidateBenchmarkResult, controlScore?: number) {
  const fitness = result.productionFitness;
  if (!fitness) return <p>Not run.</p>;
  const comparison = controlScore === undefined || fitness.score === undefined ? "control comparison unavailable"
    : fitness.score >= controlScore ? "matches/exceeds control" : "below control";
  return <>
    <div className="benchmark-axis-heading"><h3>Production fitness</h3>
      <strong>{fitness.passed ? "PASS" : "FAIL"} · {fitness.score ?? "unmeasured"}/{fitness.maximum}</strong></div>
    <p>{comparison} · {fitness.totalGeneratedTokens} generated tokens · median TTFT {formatMs(fitness.medianTtftMs)}</p>
    <ol className="benchmark-fitness-cases">{fitness.cases.map((entry) =>
      <li key={entry.id} data-pass={entry.passed}><span>{entry.id} · {entry.label}</span><strong>{entry.passed ? "PASS" : "FAIL"}</strong></li>)}</ol>
  </>;
}

export function BrowserAiBenchmark() {
  const [request] = useState(() => automationRequest(window.location.search));
  const [selectedId, setSelectedId] = useState(BROWSER_AI_BENCHMARK_CANDIDATES[0]!.id);
  const [results, setResults] = useState<CandidateBenchmarkResult[]>([]);
  const [liveSmoke, setLiveSmoke] = useState<LiveWikipediaSmokeResult>();
  const [webGpuCapabilities, setWebGpuCapabilities] = useState<WebGpuCapabilities>();
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("Ready. Candidate caches are isolated from production.");
  const automationStarted = useRef(false);
  const currentArtifact = useMemo(() => buildBrowserAiBenchmarkArtifact(results, webGpuCapabilities, liveSmoke),
    [results, webGpuCapabilities, liveSmoke]);
  const controlProductionScore = results.find((result) => result.candidateId === "qwen3-0.6b-q4f16-control")
    ?.productionFitness?.score;
  window.__browserAiBenchmarkV2 = currentArtifact;

  const publishAutomation = (state: BrowserAiBenchmarkAutomationState): void => {
    window.__browserAiBenchmarkV2Automation = state;
    if (state.status === "running") setStatus(state.detail ?? "Benchmark automation running.");
    if (state.status === "failed") setStatus(`Benchmark automation failed: ${state.error}`);
    if (state.status === "complete") setStatus("Benchmark automation complete.");
  };

  const runWebGpuProbe = async () => {
    setStatus("Inspecting portable WebGPU adapter and device limits.");
    const capabilities = await probeWebGpuCapabilities();
    setWebGpuCapabilities(capabilities);
    setStatus(capabilities.deviceAcquired ? "WebGPU capability probe complete." : `WebGPU capability probe failed: ${capabilities.error}`);
    return capabilities;
  };

  useEffect(() => {
    const parsed = request.parsed;
    if (request.error) {
      publishAutomation({ status: "failed", error: request.error });
      return;
    }
    if (!parsed) return;
    if (!parsed.autorun) {
      window.__browserAiBenchmarkV2Automation ??= { status: "idle", config: parsed.config };
      void runWebGpuProbe();
      return;
    }
    if (automationStarted.current) return;
    automationStarted.current = true;
    setRunning(true);
    const plan = benchmarkExecutionPlan(parsed.config);
    publishAutomation({ status: "idle", config: parsed.config });
    void executeBrowserAiAutomation(parsed.config, {
      publish: publishAutomation,
      probeWebGpu: async () => {
        const capabilities = await probeWebGpuCapabilities();
        setWebGpuCapabilities(capabilities);
        return capabilities;
      },
      runCandidate: async (candidateId, progress, capabilities) => {
        const result = await runCandidateBenchmark(candidateById(candidateId), progress, {
          cold: parsed.config.cacheMode === "cold",
          plan,
          webGpuCapabilities: capabilities,
          userAgent: navigator.userAgent,
        });
        setResults((existing) => [...existing.filter((entry) => entry.candidateId !== candidateId), result]);
        return result;
      },
      runLiveWikipedia: async (candidateId, progress) => {
        const result = await runLiveWikipediaSmoke(candidateById(candidateId), progress);
        setLiveSmoke(result);
        return result;
      },
      buildArtifact: (candidateResults, capabilities, smoke) =>
        buildBrowserAiBenchmarkArtifact(candidateResults, capabilities, smoke, parsed.config.budgets, {
          machine: parsed.config.machine, benchmarkRevision: parsed.config.benchmarkRevision, selectedTests: [parsed.config.test],
        }),
    }).finally(() => setRunning(false));
  }, []);

  const runCandidates = async (ids: readonly string[], cold = true) => {
    if (running) return;
    setRunning(true);
    const plan = benchmarkExecutionPlan({ test: "all", budgets: BENCHMARK_REASONING_BUDGETS });
    try {
      for (const id of ids) {
        const candidate = candidateById(id);
        const result = await runCandidateBenchmark(candidate, setStatus, { cold, plan,
          ...(webGpuCapabilities === undefined ? {} : { webGpuCapabilities }), userAgent: navigator.userAgent });
        setResults((existing) => [...existing.filter((entry) => entry.candidateId !== id), result]);
      }
      setStatus("Benchmark run complete. Review gates and deterministic scores.");
    } finally { setRunning(false); }
  };

  const runLive = async () => {
    if (running) return;
    setRunning(true);
    try {
      const result = await runLiveWikipediaSmoke(candidateById(selectedId), setStatus);
      setLiveSmoke(result);
      setStatus(`Live Wikipedia smoke ${result.passed ? "passed" : "failed"}. It is excluded from ranking.`);
    } finally { setRunning(false); }
  };

  const download = () => {
    const blob = new Blob([`${JSON.stringify(currentArtifact, null, 2)}\n`], { type: "application/json" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = "browser-ai-benchmark-v2-results.json";
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  };

  return <main className="browser-ai-benchmark">
    <header className="browser-ai-benchmark__header">
      <div><p className="eyebrow">DEVELOPMENT ONLY / WEBGPU</p><h1>Browser AI Benchmark V2</h1>
        <p>Calibrated production fitness plus 256/512/768-token advanced-agent runs, focused diagnostics, role projections, and isolated runtime measurements.</p></div>
      <strong className={running ? "benchmark-status benchmark-status--running" : "benchmark-status"}>{status}</strong>
    </header>

    <section className="ui-panel benchmark-controls" aria-label="Benchmark controls">
      <label>Candidate<select value={selectedId} disabled={running} onChange={(event) => setSelectedId(event.target.value)}>
        {BROWSER_AI_BENCHMARK_CANDIDATES.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.label}</option>)}
      </select></label>
      <button className="ui-primary" disabled={running} onClick={() => void runCandidates([selectedId])}>RUN SELECTED</button>
      <button className="ui-secondary" disabled={running} onClick={() => void runCandidates([selectedId], false)}>RERUN CACHED</button>
      <button className="ui-secondary" disabled={running} onClick={() => void runCandidates(BROWSER_AI_BENCHMARK_CANDIDATES.map((candidate) => candidate.id))}>RUN ALL REQUIRED</button>
      <button className="ui-secondary" disabled={running} onClick={() => void runLive()}>LIVE WIKIPEDIA SMOKE</button>
      <button className="ui-secondary" disabled={running} onClick={() => void runWebGpuProbe()}>REFRESH WEBGPU PROBE</button>
      <button className="ui-quiet" disabled={!results.length || running} onClick={download}>DOWNLOAD JSON</button>
    </section>

    <section className="ui-panel benchmark-capabilities" aria-label="WebGPU capabilities">
      <div className="benchmark-axis-heading"><h2>Portable WebGPU capability probe</h2>
        <strong>{webGpuCapabilities?.deviceAcquired ? "DEVICE READY" : webGpuCapabilities ? "UNAVAILABLE" : "PROBING"}</strong></div>
      {webGpuCapabilities && <>
        <dl>
          <div><dt>Adapter</dt><dd>{webGpuCapabilities.adapterInfo?.description || webGpuCapabilities.adapterInfo?.device || "identity unavailable"}</dd></div>
          <div><dt>Vendor / architecture</dt><dd>{webGpuCapabilities.adapterInfo?.vendor || "—"} / {webGpuCapabilities.adapterInfo?.architecture || "—"}</dd></div>
          <div><dt>Largest buffer</dt><dd>{formatBytes(webGpuCapabilities.deviceLimits.maxBufferSize)}</dd></div>
          <div><dt>Storage binding</dt><dd>{formatBytes(webGpuCapabilities.deviceLimits.maxStorageBufferBindingSize)}</dd></div>
          <div><dt>Shader f16</dt><dd>{webGpuCapabilities.deviceFeatures.includes("shader-f16") ? "enabled on device"
            : webGpuCapabilities.adapterFeatures.includes("shader-f16") ? "adapter supports; default device disabled" : "not reported"}</dd></div>
          <div><dt>Observed</dt><dd>{webGpuCapabilities.observedAt}</dd></div>
        </dl>
        {webGpuCapabilities.error && <p role="alert">{webGpuCapabilities.error}</p>}
        <details><summary>All reported features and limits</summary><pre>{JSON.stringify(webGpuCapabilities, null, 2)}</pre></details>
      </>}
    </section>

    <section className="benchmark-results" aria-label="Candidate results">
      {results.length === 0 ? <div className="ui-panel benchmark-empty">No benchmark results in this browser session.</div> : results.map((result) =>
        <article className="ui-panel benchmark-card" key={result.candidateId} data-candidate-id={result.candidateId}>
          <header><h2>{result.label}</h2><strong>{result.productionFitness
            ? result.productionFitness.passed ? "PRODUCTION PASS" : "PRODUCTION FAIL" : "PRODUCTION NOT RUN"}</strong></header>
          <dl>
            <div><dt>Result validity</dt><dd>{result.validity}</dd></div>
            <div><dt>Compatibility</dt><dd>{result.compatibilityQualification.state}</dd></div>
            <div><dt>Adapter</dt><dd>{result.adapter.adapterId} · {result.adapter.promptPlacement} · {result.adapter.toolCallFormat}</dd></div>
            <div><dt>Operating envelope</dt><dd>{result.operatingEnvelope.summary.hardRequirementsMet}/
              {result.operatingEnvelope.summary.knownHardRequirements} known hard requirements · {result.operatingEnvelope.summary.unknownCount} unknown</dd></div>
            <div><dt>Advanced G1 / 16 tokens</dt><dd>{result.advancedAgent.g1.status === "not-run"
              || result.advancedAgent.g1.output === undefined
              ? "NOT RUN" : result.advancedAgent.g1.passed ? "PASS" : "FAIL"}</dd></div>
            <div><dt>Cache</dt><dd>{formatBytes(result.cacheBytes)}</dd></div>
            <div><dt>Cold ready</dt><dd>{formatMs(result.coldReadyMs)}</dd></div>
            <div><dt>Warm median</dt><dd>{formatMs(result.warmReadyMedianMs)}</dd></div>
            <div><dt>Vision</dt><dd>{result.visionCapability
              ? `${result.visionCapability.score}/${result.visionCapability.maximum}` : "not applicable"}</dd></div>
            <div><dt>Failures</dt><dd>{result.failures.map((failure) => failure.message).join("; ") || "none"}</dd></div>
          </dl>
          {result.visionCapability && <section className="benchmark-axis benchmark-axis--vision">
            <div className="benchmark-axis-heading"><h3>Multimodal vision capability</h3>
              <strong>{result.visionCapability.score}/{result.visionCapability.maximum}</strong></div>
            <p>Fixture: {result.visionCapability.fixture}</p>
            <ol className="benchmark-fitness-cases">{result.visionCapability.cases.map((entry) =>
              <li key={entry.id} data-pass={entry.passed}><span>{entry.id} · {entry.prompt}</span>
                <strong>{entry.passCount}/3</strong></li>)}</ol>
          </section>}
          <section className="benchmark-axis benchmark-axis--production">
            {productionSummary(result, controlProductionScore)}
          </section>
          <section className="benchmark-axis benchmark-axis--diagnostics">
            {diagnosticsSummary(result)}
          </section>
          {result.productionFitness?.roleplaySample && <details>
            <summary>PF11B · human-review character transcript</summary>
            <pre>{JSON.stringify(result.productionFitness.roleplaySample, null, 2)}</pre>
          </details>}
          <section className="benchmark-axis benchmark-axis--advanced">
            <div className="benchmark-axis-heading"><h3>Advanced agent capability</h3>
              <strong>{Object.values(result.advancedAgent.budgets).some((budget) => budget?.gatePass) ? "QUALIFIED" : "NOT QUALIFIED"}</strong></div>
            <div className="benchmark-budget-grid">
            {BENCHMARK_REASONING_BUDGETS.map((budget) => <section key={budget} className="benchmark-budget" data-budget={budget}>
              <h4>{budget} max new tokens</h4>{budgetSummary(result.advancedAgent.budgets[`${budget}`])}
            </section>)}
            </div>
          </section>
          <details><summary>Adapter contract and generation profiles</summary><pre>{JSON.stringify(result.adapter, null, 2)}</pre></details>
          <details><summary>Operating envelope and adapter conformance</summary><pre>{JSON.stringify({
            compatibilityQualification: result.compatibilityQualification, adapterConformance: result.adapterConformance, operatingEnvelope: result.operatingEnvelope,
          }, null, 2)}</pre></details>
          <details><summary>Score and raw evidence</summary><pre>{JSON.stringify(result, null, 2)}</pre></details>
        </article>)}
    </section>

    {liveSmoke && <section className="ui-panel benchmark-live"><h2>Live Wikipedia smoke (not ranked)</h2>
      <pre>{JSON.stringify(liveSmoke, null, 2)}</pre></section>}

    <section className="ui-panel benchmark-json"><h2>Machine-readable session artifact</h2>
      <textarea readOnly aria-label="Machine-readable benchmark results" value={JSON.stringify(currentArtifact, null, 2)} /></section>
  </main>;
}
