import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadModelCardInventory } from "./model-card-inventory.mjs";

test("model-card inventory discovers, sorts, and selects active JSON cards", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "bml-cards-"));
  const testing = path.join(root, "testing");
  mkdirSync(testing);
  writeFileSync(path.join(testing, "z.json"), JSON.stringify({
    schemaVersion: 1, runOrder: 20, candidate: { id: "z-model" },
  }));
  writeFileSync(path.join(testing, "a.json"), JSON.stringify({
    schemaVersion: 1, runOrder: 10, default: true, candidate: { id: "a-model" },
  }));
  writeFileSync(path.join(testing, "README.md"), "ignored");
  const inventory = loadModelCardInventory(root);
  assert.deepEqual(inventory.candidateIds, ["a-model", "z-model"]);
  assert.equal(inventory.defaultCandidateId, "a-model");
});
