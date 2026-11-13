import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadVisionFixtures } from "./vision-fixture-lib.mjs";
import { DEFAULT_VISION_FIXTURES, expandEvaluationPlan, validateEvaluationPlan } from "./evaluation-plan-lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = {
  schemaVersion: 1, id: "vision-test", cardsDir: "testing",
  execution: { machine: "mac-m4", runtime: ["browser"], mode: "headless",
    cache: "reuse", trials: 1, maxJobs: 100 },
  suites: ["vision"], matrix: { maxNewTokens: [256] },
  vision: { fixtures: [...DEFAULT_VISION_FIXTURES] },
  output: { retainTranscripts: true, publishCatalog: true },
};
const clone = x => JSON.parse(JSON.stringify(x));
describe("plan-driven vision fixtures", () => {
  it("loads default table cases from owned image fixtures", () => {
    const cases = loadVisionFixtures(root, DEFAULT_VISION_FIXTURES);
    assert.deepEqual(cases.map(x => x.id), ["table-text", "table-reasoning"]);
    assert.equal(cases[0].expected, "NO SINGLE ORACLE OWNS THE RESULT");
    assert.equal(cases[1].expected, "REFERENCE");
    assert.equal(cases[0].trials, 3);
  });
  it("expands a vision-only plan without running production/agent suites", () => {
    const work = expandEvaluationPlan(base, ["qwen35-0.8b-multimodal"]);
    assert.equal(work.runnable, 1);
    assert.equal(work.jobs[0].suite, "vision");
    assert.deepEqual(work.visionFixtures, DEFAULT_VISION_FIXTURES);
  });
  it("defaults to the table fixtures when the section is absent", () => {
    const p = clone(base);
    delete p.vision;
    assert.deepEqual(expandEvaluationPlan(p, ["vision-candidate"]).visionFixtures, DEFAULT_VISION_FIXTURES);
  });
  it("rejects fixture path escapes, duplicate entries and wrong suite", () => {
    const bad = clone(base);
    bad.vision.fixtures = ["../other.json"];
    assert.throws(() => validateEvaluationPlan(bad), /vision.fixtures/);
    bad.vision.fixtures = [DEFAULT_VISION_FIXTURES[0], DEFAULT_VISION_FIXTURES[0]];
    assert.throws(() => validateEvaluationPlan(bad), /vision.fixtures/);
    bad.vision.fixtures = [...DEFAULT_VISION_FIXTURES];
    bad.suites = ["advanced"];
    assert.throws(() => validateEvaluationPlan(bad), /require the vision suite/);
  });
  it("blocks unsupported Node vision rather than silently recording a non-vision result", () => {
    const p = clone(base);
    p.execution.runtime = ["node"];
    const work = expandEvaluationPlan(p, ["vision-candidate"]);
    assert.equal(work.blocked, 1);
    assert.match(work.jobs[0].blocked.join(" "), /node vision/);
  });
});
