import assert from "node:assert/strict";
import test from "node:test";
import { automationExitCode, browserAiArtifactBasename, browserAiQuery, cardsDirFromArgs, formatBrowserAiSummary,
  formatVisionQualification, mergeBrowserAiArtifacts, parseBrowserAiCliArgs, uniqueArtifactPath } from "./browser-ai-benchmark-cli-lib.mjs";

const inventory = { candidateIds: ["qwen3-0.6b-q4f16-control", "other-model"], defaultCandidateId: "qwen3-0.6b-q4f16-control" };

test("CLI parses selectors and builds the equivalent query contract", () => {
  const args = [
    "--", "--machine", "mac-m4", "--cards-dir", "sets/three", "--candidate", "qwen3-0.6b-q4f16-control", "--test", "t2",
    "--budget", "768", "--cold", "--live-wikipedia", "--headful",
  ];
  assert.equal(cardsDirFromArgs(args), "sets/three");
  const options = parseBrowserAiCliArgs(args, { cardsDir: "sets/three" }, inventory);
  assert.equal(options.machine, "mac-m4");
  assert.equal(options.cacheMode, "cold");
  assert.equal(options.headful, true);
  assert.equal(options.cardsDir, "sets/three");
  const query = new URLSearchParams(browserAiQuery(options, options.candidate, "abc123"));
  assert.deepEqual(Object.fromEntries(query), {
    "browser-ai-benchmark": "1",
    autorun: "1",
    candidate: "qwen3-0.6b-q4f16-control",
    test: "t2",
    budget: "768",
    cache: "cold",
    machine: "mac-m4",
    revision: "abc123",
    "live-wikipedia": "1",
  });
});

test("CLI rejects conflicting cache flags and live smoke over all candidates", () => {
  assert.throws(() => parseBrowserAiCliArgs(["--cold", "--cached"], {}, inventory), /only one/);
  assert.throws(() => parseBrowserAiCliArgs(["--candidate", "all", "--live-wikipedia"], {}, inventory), /one candidate/);
  assert.throws(() => parseBrowserAiCliArgs(["--candidate", "missing"], {}, inventory), /Unknown candidate/);
});

test("artifact naming is stable and never overwrites an existing path", () => {
  const basename = browserAiArtifactBasename({
    timestamp: new Date("2026-11-10T20:31:12.835Z"),
    machine: "mac m4",
    commit: "abcdef123456",
    model: "qwen35-2b-q4f16",
  });
  assert.equal(basename, "qwen35-2b-q4f16_mac-m4_20261110T203112Z_3456.json");
  const first = "/repo/docs/benchmarks/runs/qwen35-2b-q4f16_mac-m4_20261110T203112Z_3456.json";
  assert.equal(uniqueArtifactPath("/repo/docs/benchmarks/runs", basename, (candidate) => candidate === first),
    "/repo/docs/benchmarks/runs/qwen35-2b-q4f16_mac-m4_20261110T203112Z_3456_2.json");
});

test("model failure remains successful benchmark data while harness failure exits nonzero", () => {
  assert.equal(automationExitCode({ status: "complete", artifact: {
    candidates: [{ failures: [{ phase: "initialization", message: "model failed" }] }],
  } }), 0);
  assert.equal(automationExitCode({ status: "failed", error: "page crashed" }), 1);
  assert.equal(automationExitCode({ status: "running" }), 1);
});

test("isolated candidate artifacts merge and summarize deterministically", () => {
  const base = {
    schemaVersion: 13,
    suite: "browser-ai-benchmark-v2",
    benchmarkRevision: "abc123",
    machine: "mac",
    generatedAt: "2026-11-10T00:00:00.000Z",
    settings: { reasoningBudgets: [256, 512, 768] },
    webGpuCapabilities: { deviceAcquired: true },
    candidates: [{ candidateId: "one", productionFitness: { score: 100, maximum: 100 },
      diagnostics: {
        roles: [{ id: "general-game", rating: "STRONG", score: 1, maximum: 1, evidence: ["production"] }],
        failures: [{ caseId: "T1", reasons: ["failed-to-stop"], succeeded: ["inspect"], failed: ["finish"] }],
      },
      diagnosticProbes: { cases: [{ passed: true }, { passed: false }] },
      advancedAgent: { g1: { passed: true, output: "READY" }, budgets: {} }, failures: [] }],
  };
  const merged = mergeBrowserAiArtifacts([base, {
    ...base,
    generatedAt: "2026-11-10T00:01:00.000Z",
    candidates: [{ candidateId: "two", advancedAgent: { g1: { passed: false }, budgets: {} },
      failures: [{ phase: "initialization", message: "failed" }] }],
  }]);
  assert.deepEqual(merged.candidates.map((candidate) => candidate.candidateId), ["one", "two"]);
  assert.equal(merged.generatedAt, "2026-11-10T00:01:00.000Z");
  const summary = formatBrowserAiSummary(merged, { machine: "mac", commit: "abc" });
  assert.match(summary, /one/);
  assert.match(summary, /two/);
  assert.match(summary, /initialization/);
  assert.match(summary, /Role and failure diagnostics/);
  assert.match(summary, /general-game=STRONG/);
  assert.match(summary, /failed-to-stop/);
});

test("CLI defaults to every card in the selected folder", () => {
  const options = parseBrowserAiCliArgs([], { cardsDir: "testing" }, inventory);
  assert.equal(options.candidate, "all");
  assert.equal(options.cardsDir, "testing");
});


test("vision reporting excludes fixture failures from assessed case counts", () => {
  assert.equal(formatVisionQualification(undefined), "not run");
  assert.equal(formatVisionQualification({ supported: false, cases: [] }), "unsupported");
  assert.equal(formatVisionQualification({ supported: true, score: 1, maximum: 3, cases: [
    { id: "people", attemptCount: 3, passed: true },
    { id: "svg", attemptCount: 0, error: "decode", errorKind: "fixture", passed: false },
    { id: "runtime", attemptCount: 1, error: "gpu", errorKind: "runtime", passed: false },
  ] }), "1/1 assessed; 1 fixture errors; 1 runtime errors");
});
