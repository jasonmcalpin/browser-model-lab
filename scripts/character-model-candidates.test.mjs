import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadModelCardInventory } from "./model-card-inventory.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => JSON.parse(readFileSync(path.join(root, name), "utf8"));

test("active 4B character model uses its actual Transformers.js ONNX checkpoint", () => {
  const inventory = loadModelCardInventory(root, "testing");
  const card = inventory.cards.find(entry => entry.candidate.id === "qwen3-4b-q4f16-character");
  assert.ok(card, "4B model should be active in the testing inventory");
  assert.equal(card.candidate.modelId, "onnx-community/Qwen3-4B-ONNX");
  assert.equal(card.candidate.dtype, "q4f16");
  assert.equal(card.candidate.pipelineTask, "text-generation");
  assert.equal(card.candidate.compatibilityProfile.runtime.kind, "pipeline");
  assert.equal(card.candidate.compatibilityProfile.runtime.dtype, "q4f16");
  assert.equal(card.candidate.template.kind, "qwen3");
  const experiment = read("experiments/mara-dialogue/060-qwen3-4b.json");
  assert.deepEqual(card.candidate, experiment.candidate);
});

test("safetensors-only roleplay candidates stay visible as pending, not falsely executable", () => {
  const inventory = loadModelCardInventory(root, "testing");
  const selected = [
    ["testing/pending/150-luna-7b-a4b-roleplay.json", "beyoru/Luna-7B-A4B"],
    ["testing/pending/160-infinityrp-v1-7b.json", "Endevor/InfinityRP-v1-7B"],
  ];
  for (const [file, modelId] of selected) {
    const entry = read(file);
    assert.equal(entry.modelId, modelId);
    assert.equal(entry.runtimeEligibility, "pending");
    assert.equal(entry.format, "safetensors");
    assert.ok(entry.blockers.length > 0);
    assert.equal(inventory.candidateIds.includes(entry.id), false);
  }
});
