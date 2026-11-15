import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createServer } from "vite";
import { loadModelCardInventory } from "./model-card-inventory.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function browserManifest(cardsDir) {
  const previous = process.env.BML_CARDS_DIR;
  process.env.BML_CARDS_DIR = cardsDir;
  let server;
  try {
    server = await createServer({
      root,
      configFile: path.join(root, "vite.config.ts"),
      server: { middlewareMode: true },
      appType: "custom",
      logLevel: "silent",
    });
    const mod = await server.ssrLoadModule("virtual:bml-model-cards");
    return Object.values(mod.default).map(card => card.candidate.id);
  } finally {
    await server?.close();
    if (previous === undefined) delete process.env.BML_CARDS_DIR;
    else process.env.BML_CARDS_DIR = previous;
  }
}

test("browser and CLI select identical card inventories for the default folder", async () => {
  const browser = await browserManifest("testing");
  const node = loadModelCardInventory(root, "testing").candidateIds;
  assert.deepEqual(new Set(browser), new Set(node));
});

test("browser respects a host-selected non-default experiment directory", async () => {
  const browser = await browserManifest("experiments/mara-dialogue");
  const node = loadModelCardInventory(root, "experiments/mara-dialogue").candidateIds;
  assert.deepEqual(new Set(browser), new Set(node));
  assert.ok(browser.includes("qwen3-4b-q4f16-character"));
});

test("browser accepts a host-selected single card file", async () => {
  assert.deepEqual(await browserManifest("experiments/mara-dialogue/060-qwen3-4b.json"),
    ["qwen3-4b-q4f16-character"]);
});

test("browser host cannot select paths outside its repository", async () => {
  await assert.rejects(browserManifest("../outside"), /outside the configured root/);
});
