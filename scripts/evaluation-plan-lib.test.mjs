import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { expandEvaluationPlan, validateEvaluationPlan } from "./evaluation-plan-lib.mjs";

const base = {
  schemaVersion: 1, id: "baseline",
  cardsDir: "testing",
  execution: { runtime: ["browser", "node"], mode: "headless", cache: "reuse",
    machine: "mac-m4", trials: 2, maxJobs: 50 },
  suites: ["advanced"],
  matrix: { maxNewTokens: [256, 512, 768] },
  output: { retainTranscripts: true, publishCatalog: true },
};
const copy = value => JSON.parse(JSON.stringify(value));

describe("declarative evaluation plans", () => {
  it("derives all candidate identities exclusively from the card directory", () => {
    const expanded = expandEvaluationPlan(base, ["lfm3-1.7b-q4f16", "qwen3-0.6b-q4f16-control"]);
    assert.equal(expanded.count, 24);
    assert.equal(expanded.runnable, 24);
    assert.equal(expanded.blocked, 0);
    assert.equal(new Set(expanded.jobs.map(job => job.id)).size, 24);
    assert.deepEqual(expandEvaluationPlan(base, ["lfm3-1.7b-q4f16", "qwen3-0.6b-q4f16-control"]), expanded);
  });
  it("rejects any explicit model membership in plan", () => {
    const withModel = copy(base);
    withModel.models = { select: ["lfm3-1.7b-q4f16"] };
    assert.throws(() => validateEvaluationPlan(withModel), /unsupported key models/);
  });
  it("does not silently treat character test matrices as an existing technical suite", () => {
    const p = copy(base);
    p.suites = ["character"];
    p.execution.runtime = ["browser"];
    p.matrix = { maxNewTokens: [256, 512], temperature: [0.2, 0.8], memoryStrategy: ["rolling", "recent"] };
    const expanded = expandEvaluationPlan(p, ["lfm3-1.7b-q4f16"]);
    assert.equal(expanded.count, 16);
    assert.equal(expanded.runnable, 0);
    assert.match(expanded.jobs[0].blocked.join(" "), /dedicated character runner/);
  });
  it("does not pretend that production tests support arbitrary output caps", () => {
    const p = copy(base);
    p.suites = ["production"];
    p.matrix = { maxNewTokens: [512] };
    const expanded = expandEvaluationPlan(p, ["lfm3-1.7b-q4f16"]);
    assert.equal(expanded.runnable, 0);
    assert.match(expanded.jobs[0].blocked.join(" "), /fixed at 256/);
  });
  it("rejects path traversal, unsupported flags and runaway workload", () => {
    const evil = copy(base); evil.cardsDir = "../secrets";
    assert.throws(() => validateEvaluationPlan(evil), /repository relative/);
    const typo = copy(base); typo.execution.mysteryFlag = true;
    assert.throws(() => validateEvaluationPlan(typo), /unsupported key/);
    const big = copy(base); big.execution.maxJobs = 1;
    assert.throws(() => expandEvaluationPlan(big, ["model-a"]), /exceeds maxJobs/);
  });
  it("blocks incompatible backend settings before launching either runner", () => {
    const p = copy(base); p.execution.mode = "headful"; p.execution.cache = "cold";
    const expanded = expandEvaluationPlan(p, ["model-a"]);
    assert.equal(expanded.runnable, 6);
    assert.equal(expanded.blocked, 6);
    assert.match(expanded.jobs.find(j => j.runtime === "node").blocked.join(" "), /headful/);
  });
});
