import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { browserAiQuery } from "./browser-ai-benchmark-cli-lib.mjs";
import { loadModelCardInventory } from "./model-card-inventory.mjs";

test("model-card inventory discovers, sorts, and selects active JSON cards", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "bml-cards-"));
  const testing = path.join(root, "testing");
  mkdirSync(testing);
  writeFileSync(path.join(testing, "z.json"), JSON.stringify({
    schemaVersion: 2, runOrder: 20, candidate: { id: "z-model", compatibilityProfile: {} },
  }));
  const aCard = {
    schemaVersion: 2, runOrder: 10, default: true, candidate: { id: "a-model", compatibilityProfile: {} },
  };
  writeFileSync(path.join(testing, "a.json"), JSON.stringify(aCard));
  writeFileSync(path.join(testing, "README.md"), "ignored");
  const inventory = loadModelCardInventory(root);
  assert.deepEqual(inventory.candidateIds, ["a-model", "z-model"]);
  assert.equal(inventory.defaultCandidateId, "a-model");
  const query = new URLSearchParams(browserAiQuery({
    candidate: "a-model", test: "all", budget: "all", cacheMode: "cached", machine: "test", liveWikipedia: false,
  }, "a-model", "abc123", inventory.cards[0]));
  assert.deepEqual(JSON.parse(query.get("model-card")), aCard);
  assert.equal(Object.hasOwn(inventory.cards[0], "filename"), false);
});

test("inventory rejects executable-looking model-card content", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "bml-code-card-"));
  const testing = path.join(root, "testing");
  mkdirSync(testing);
  writeFileSync(path.join(testing, "bad.json"), JSON.stringify({
    schemaVersion: 2, notes: ["function() { return 1; }"], candidate: { id: "bad-model", compatibilityProfile: {} },
  }));
  assert.throws(() => loadModelCardInventory(root), /executable-looking/);
});
