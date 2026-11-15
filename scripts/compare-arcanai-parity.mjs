#!/usr/bin/env node
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

export function median(values) {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function deltaPct(reference, observed) {
  return Number.isFinite(reference) && reference > 0 && Number.isFinite(observed)
    ? ((observed / reference) - 1) * 100 : undefined;
}

function validatePair(native, plugin) {
  if (native.environment?.executor !== "native" || plugin.environment?.executor !== "arcanai")
    throw new Error("Expected one native artifact and one arcanai artifact.");
  if (native.machine !== plugin.machine || native.benchmarkRevision !== plugin.benchmarkRevision)
    throw new Error("Paired artifacts must share machine and benchmark revision.");
  if (JSON.stringify(native.manifest?.selectedTests) !== JSON.stringify(plugin.manifest?.selectedTests))
    throw new Error("Paired artifacts must use the same selected benchmark tests.");
  const a = native.candidates.map(x => x.candidateId).sort();
  const b = plugin.candidates.map(x => x.candidateId).sort();
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error("Paired artifacts have different candidate sets.");
  for (const candidate of native.candidates) {
    const match = plugin.candidates.find(x => x.candidateId === candidate.candidateId);
    if (candidate.modelId !== match.modelId || candidate.revision !== match.revision ||
      candidate.dtype !== match.dtype || candidate.adapter?.compatibilityProfileId !== match.adapter?.compatibilityProfileId)
      throw new Error(`Model execution profile mismatch: ${candidate.candidateId}`);
  }
}

/** Pure comparison. Never modifies raw source artifacts or rescales benchmark scores. */
export function comparePairs(pairs) {
  if (!pairs.length) throw new Error("At least one paired run is required.");
  for (const [native, plugin] of pairs) validatePair(native, plugin);
  const [firstNative] = pairs[0];
  const ids = firstNative.candidates.map(x => x.candidateId);
  const models = ids.map(id => {
    const trials = pairs.map(([native, plugin]) => {
      const a = native.candidates.find(x => x.candidateId === id);
      const b = plugin.candidates.find(x => x.candidateId === id);
      return {
        scoreNative: a.productionFitness?.score ?? null,
        scoreArcanai: b.productionFitness?.score ?? null,
        modelMsNative: a.productionFitness?.modelMs ?? null,
        modelMsArcanai: b.productionFitness?.modelMs ?? null,
        totalMsNative: a.productionFitness?.endToEndMs ?? null,
        totalMsArcanai: b.productionFitness?.endToEndMs ?? null,
        medianTtftMsNative: a.productionFitness?.medianTtftMs ?? null,
        medianTtftMsArcanai: b.productionFitness?.medianTtftMs ?? null,
        tokenCountNative: a.productionFitness?.totalGeneratedTokens ?? null,
        tokenCountArcanai: b.productionFitness?.totalGeneratedTokens ?? null,
        validityNative: a.validity,
        validityArcanai: b.validity
      };
    });
    const latencyDeltas = trials.map(x => deltaPct(x.modelMsNative, x.modelMsArcanai)).filter(Number.isFinite);
    const scoreDeltas = trials.map(x => x.scoreNative !== null && x.scoreArcanai !== null ? x.scoreArcanai - x.scoreNative : undefined).filter(Number.isFinite);
    return {
      id,
      trials,
      medianModelLatencyDeltaPct: median(latencyDeltas),
      medianScoreDelta: median(scoreDeltas)
    };
  });
  return {
    schemaVersion: 1,
    kind: "arcanai-bml-parity",
    pairs: pairs.length,
    machine: firstNative.machine,
    benchmarkRevision: firstNative.benchmarkRevision,
    generatedAt: new Date().toISOString(),
    caveat: "Not a causal plugin-overhead estimate until repeat paired trials on the same machine and cache state control sampling/noise.",
    models
  };
}

function render(result) {
  const lines = [
    "# ArcanAI vs BML native execution",
    "",
    `Machine: ${result.machine}; paired trials: ${result.pairs}; revision: ${result.benchmarkRevision}`,
    "",
    "| Model | Median model-time Δ | Median score Δ | Trials |",
    "| --- | ---: | ---: | ---: |"
  ];
  for (const model of result.models) {
    const time = model.medianModelLatencyDeltaPct;
    const score = model.medianScoreDelta;
    lines.push(`| ${model.id} | ${time === undefined ? "n/a" : time.toFixed(2) + "%"} | ${score === undefined ? "n/a" : score.toFixed(2)} | ${model.trials.length} |`);
  }
  lines.push("", result.caveat, "");
  return lines.join("\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const args = process.argv.slice(2);
  const outputIndex = args.indexOf("--output");
  const output = outputIndex === -1 ? undefined : args[outputIndex + 1];
  if (outputIndex >= 0) args.splice(outputIndex, 2);
  if (!args.length || args.length % 2) {
    process.stderr.write("Usage: node scripts/compare-arcanai-parity.mjs native.json arcanai.json [native2.json arcanai2.json ...] [--output output.json]\n");
    process.exitCode = 2;
  } else {
    try {
      const pairs = [];
      for (let i = 0; i < args.length; i += 2) {
        pairs.push([JSON.parse(readFileSync(args[i], "utf8")), JSON.parse(readFileSync(args[i + 1], "utf8"))]);
      }
      const comparison = comparePairs(pairs);
      process.stdout.write(render(comparison));
      if (output) {
        mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
        writeFileSync(output, JSON.stringify(comparison, null, 2) + "\n", { flag: "wx" });
      }
    } catch (error) {
      process.stderr.write(`Parity comparison failed: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    }
  }
}
