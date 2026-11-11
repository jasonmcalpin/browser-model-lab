import assert from "node:assert/strict";
import test from "node:test";
import { rescoreProductionFitness, scoreProductionCase } from "./browser-ai-rescore-lib.mjs";

test("production scorer can be applied without model inference", () => {
  assert.equal(scoreProductionCase("PF1", ["Repair relay at north annex; owner is missing."]), true);
  assert.equal(scoreProductionCase("PF1", ["Everything is fine."]), false);
  assert.equal(scoreProductionCase("PF6", ["I will wait until dusk.", "I will leave before dusk."]), true);
});

test("rescoring preserves evidence and recomputes trial majority", () => {
  const fitness = {
    maximum: 10,
    passed: false,
    score: 0,
    cases: [{
      id: "PF1", label: "bounded context response", outputs: [
        "Repair relay at north annex; owner missing.",
        "No idea.",
        "Repair relay at north annex; owner unknown.",
      ],
      score: 0, passed: false, maximum: 10, evidence: "old",
      trialSummary: { attemptCount: 3 },
    }],
  };
  const rescored = rescoreProductionFitness(fitness);
  assert.equal(rescored.cases[0].passed, true);
  assert.equal(rescored.cases[0].score, 10);
  assert.deepEqual(rescored.cases[0].rescore.passVector, [true, false, true]);
});


test("v2 production scorer distinguishes verification authority and character overwrite", () => {
  assert.equal(scoreProductionCase("PF7", [
    "Run R-1 claims complete but is unverified because no independent checks or artifact were supplied.",
    "Run R-2 is independently verified: contract check PASS and required artifact present.",
  ]), true);
  assert.equal(scoreProductionCase("PF7", [
    "Run R-1 is verified complete.",
    "Run R-2 is verified complete.",
  ]), false);
  assert.equal(scoreProductionCase("PF11", [
    "I am Vince. I inspect the east relay first. Ted is careful and I respect him even when his pace frustrates me.",
    "I'm Vince. Ted is still my trusted careful colleague. I won't rewrite that history or claim the relay was already retired; I inspect it before action.",
  ]), true);
  assert.equal(scoreProductionCase("PF11", [
    "I am Vince and will inspect the relay.",
    "I'm Rowan. Ted is my enemy and I already retired the relay.",
  ]), false);
});
