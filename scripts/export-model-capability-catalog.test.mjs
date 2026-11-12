import test from "node:test";
import assert from "node:assert/strict";
import { buildModelRuntimeCatalog, executionProfileIdentity } from "./export-model-capability-catalog.mjs";

const currentCard = {
  candidate: {
    id: "qwen-control",
    modelId: "onnx-community/Qwen3-0.6B-ONNX",
    revision: "main",
    family: "qwen3",
    adapterId: "declarative-v1",
    compatibilityProfileId: "qwen3-nonthinking-native-v1",
    structuredOutput: "json-fallback",
    compatibilityProfile: {
      id: "qwen3-nonthinking-native-v1",
      adapterId: "declarative-v1",
      tools: { mode: "native-template", callFormat: "tagged-json" },
      reasoning: { control: "enable_thinking" },
      profiles: null
    }
  }
};

function artifact({ generatedAt, scorerRevision = "scorer-v1", host = "node", production = 80,
  role = "PARTIAL", machine = "mac-m4", compatibility = "COMPATIBLE", validity = "VALID",
  adapterId = "declarative-v1", toolCallFormat = "tagged-json" }) {
  return {
    schemaVersion: 13,
    suite: "browser-ai-benchmark-v2",
    generatedAt,
    benchmarkRevision: "abc123",
    machine,
    manifest: { scorerRevision },
    environment: {
      userAgent: host === "node" ? "node/v22.18.0 darwin/arm64" : "Mozilla/5.0 Chrome/156",
      webgpu: true,
      transformersJs: "4.3.2"
    },
    settings: { backend: "webgpu" },
    candidates: [{
      candidateId: "qwen-control",
      modelId: "onnx-community/Qwen3-0.6B-ONNX",
      revision: "main",
      dtype: "q4f16",
      pipelineTask: "text-generation",
      structuredOutput: "json-fallback",
      adapter: {
        adapterId,
        compatibilityProfileId: "qwen3-nonthinking-native-v1",
        toolSupportMode: "native-template",
        toolCallFormat,
        reasoningFormat: "none"
      },
      compatibilityQualification: { state: compatibility },
      validity,
      productionFitness: { score: production, maximum: 120 },
      diagnostics: {
        roles: [{ id: "general-game", rating: role, score: role === "STRONG" ? 1 : 0.6, maximum: 1 }]
      },
      warmReadyMedianMs: 400,
      cacheBytes: 580_000_000,
      advancedAgent: { g1: { ttftMs: 60, modelMs: 70 } },
      failures: []
    }]
  };
}

test("execution profile identity separates browser and node hosts", () => {
  const node = artifact({ generatedAt: "2026-11-12T00:00:00Z", host: "node" });
  const browser = artifact({ generatedAt: "2026-11-12T00:00:00Z", host: "browser" });
  assert.notEqual(executionProfileIdentity(node, node.candidates[0]).id,
    executionProfileIdentity(browser, browser.candidates[0]).id);
});

test("same engine profile aggregates repeated runs instead of keeping the best score", () => {
  const result = buildModelRuntimeCatalog({
    cards: [currentCard],
    artifacts: [
      { ref: "runs/a.json", artifact: artifact({ generatedAt: "2026-11-12T01:00:00Z", production: 120 }) },
      { ref: "runs/b.json", artifact: artifact({ generatedAt: "2026-11-12T02:00:00Z", production: 70 }) },
      { ref: "runs/c.json", artifact: artifact({ generatedAt: "2026-11-12T03:00:00Z", production: 90 }) },
    ],
    generatedAt: "2026-11-12T04:00:00Z",
  });
  assert.equal(result.profiles.length, 1);
  assert.deepEqual(result.profiles[0].currentQualification.production, {
    median: 90, minimum: 70, maximum: 120, scaleMaximum: 120, sampleSize: 3
  });
  assert.equal(result.profiles[0].observationSummary.totalRuns, 3);
});

test("new scorer revision becomes current without mixing superseded evidence", () => {
  const result = buildModelRuntimeCatalog({
    artifacts: [
      { ref: "runs/old.json", artifact: artifact({
        generatedAt: "2026-11-12T01:00:00Z", scorerRevision: "scorer-v1", production: 120
      }) },
      { ref: "runs/new.json", artifact: artifact({
        generatedAt: "2026-11-12T02:00:00Z", scorerRevision: "scorer-v2", production: 60
      }) },
    ],
    generatedAt: "2026-11-12T03:00:00Z",
  });
  const profile = result.profiles[0];
  assert.equal(profile.currentQualification.scorerRevision, "scorer-v2");
  assert.equal(profile.currentQualification.production.median, 60);
  assert.deepEqual(profile.observationSummary.supersededEvidence, ["runs/old.json"]);
});

test("machine differences remain observations, not separate execution profiles", () => {
  const result = buildModelRuntimeCatalog({
    artifacts: [
      { ref: "runs/mac.json", artifact: artifact({ generatedAt: "2026-11-12T01:00:00Z", machine: "mac-m4" }) },
      { ref: "runs/mini.json", artifact: artifact({ generatedAt: "2026-11-12T02:00:00Z", machine: "mini-8845hs" }) },
    ],
  });
  assert.equal(result.profiles.length, 1);
  assert.deepEqual(result.profiles[0].observationSummary.machines, ["mac-m4", "mini-8845hs"]);
});

test("declared models without evidence stay explicitly unqualified", () => {
  const result = buildModelRuntimeCatalog({
    cards: [{ candidate: {
      id: "untested", modelId: "owner/model", revision: "main", family: "test",
      compatibilityProfileId: "test-v1"
    } }],
    artifacts: [],
  });
  assert.equal(result.profiles.length, 0);
  assert.equal(result.declaredModelsWithoutEvidence[0].candidateId, "untested");
});


test("current executable protocol comes from the model card and stale runtime evidence is not current qualification", () => {
  const result = buildModelRuntimeCatalog({
    cards: [currentCard],
    artifacts: [{
      ref: "runs/legacy.json",
      artifact: artifact({
        generatedAt: "2026-11-12T01:00:00Z",
        host: "browser",
        adapterId: "qwen3",
        toolCallFormat: "qwen-native"
      })
    }]
  });
  const profile = result.profiles[0];
  assert.equal(profile.protocol.adapterId, "declarative-v1");
  assert.equal(profile.protocol.toolCallFormat, "tagged-json");
  assert.equal(profile.observedProtocol.adapterId, "qwen3");
  assert.equal(profile.currentQualification.status, "stale-config");
  assert.deepEqual(profile.currentQualification.staleConfigurationEvidence, ["runs/legacy.json"]);
  assert.equal(profile.evidence[0].matchesCurrentProtocol, false);
});
