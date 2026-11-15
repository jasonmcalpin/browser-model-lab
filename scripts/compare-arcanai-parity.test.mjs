import test from "node:test";
import assert from "node:assert/strict";
import { comparePairs } from "./compare-arcanai-parity.mjs";

function artifact(executor, modelMs = 100, score = 75) {
  return {
    machine: "mac-m4",
    benchmarkRevision: "abcdef123",
    environment: { executor },
    manifest: { selectedTests: ["production"] },
    candidates: [{
      candidateId: "model-a", modelId: "repo/model", revision: "abc",
      dtype: "q4f16", adapter: { compatibilityProfileId: "p1" },
      validity: "VALID",
      productionFitness: { modelMs, endToEndMs: modelMs + 40, score, medianTtftMs: 12, totalGeneratedTokens: 32 }
    }]
  };
}

test("compares paired artifacts while preserving raw measurements", () => {
  const baseline = artifact("native", 100, 75);
  const plugin = artifact("arcanai", 110, 75);
  const result = comparePairs([[baseline, plugin], [baseline, plugin]]);
  assert.equal(result.pairs, 2);
  assert.ok(Math.abs(result.models[0].medianModelLatencyDeltaPct - 10) < 1e-9);
  assert.equal(result.models[0].medianScoreDelta, 0);
  assert.equal(baseline.candidates[0].productionFitness.modelMs, 100);
});

test("refuses comparing different machines or execution profiles", () => {
  const a = artifact("native");
  const b = artifact("arcanai");
  b.machine = "rtx3050";
  assert.throws(() => comparePairs([[a, b]]), /share machine/);
  b.machine = a.machine;
  b.candidates[0].adapter.compatibilityProfileId = "different";
  assert.throws(() => comparePairs([[a, b]]), /profile mismatch/);
});

test("refuses comparing same executor on both sides", () => {
  assert.throws(() => comparePairs([[artifact("native"), artifact("native")]]), /Expected one native/);
});
