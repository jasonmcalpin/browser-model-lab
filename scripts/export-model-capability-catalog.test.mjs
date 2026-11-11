import test from "node:test";
import assert from "node:assert/strict";
import { calculateCost, buildCatalog } from "./export-model-capability-catalog.mjs";

test("cost accounts for cached tokens separately", () => {
  assert.equal(calculateCost({input: 1_000_000, cachedInput: 200_000, output: 500_000},
    {inputPerMillion: 2, cachedInputPerMillion: 0.5, outputPerMillion: 8}), 5.7);
});
test("unknown pricing or usage is not zero cost", () => {
  assert.equal(calculateCost({input: 10, output: 20}, undefined), null);
  assert.equal(calculateCost({input: 10}, {inputPerMillion: 1, outputPerMillion: 1, cachedInputPerMillion: 1}), null);
});
test("rejects inconsistent usage", () => {
  assert.throws(() => calculateCost({input: 2, cachedInput: 3, output: 1},
    {inputPerMillion: 1, outputPerMillion: 1, cachedInputPerMillion: 1}));
});
test("catalog preserves evidence and never invents capability scores", () => {
  const result = buildCatalog({cards:[{id:"test",model:{modelId:null},deployment:{runtime:"openai-api"}}],
    runs:[{id:"run1",modelId:"test",benchmarkId:"typescript-contract-change-v1",status:"unverified",usage:{input:12,output:4}}]});
  assert.equal(result.models[0].runtime,"openai-api");
  assert.equal(result.benchmarkRuns[0].estimatedCostUsd,null);
  assert.deepEqual(result.capabilityAssessments,[]);
});
