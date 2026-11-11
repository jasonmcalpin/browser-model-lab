#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

export function calculateCost(usage, pricing) {
  const rates = ["input", "output", "cachedInput"];
  for (const key of rates) {
    if (usage[key] !== undefined && (!Number.isInteger(usage[key]) || usage[key] < 0))
      throw new Error(`Invalid token usage: ${key}`);
  }
  if (!pricing || !["inputPerMillion", "outputPerMillion", "cachedInputPerMillion"].every((key) =>
    Number.isFinite(pricing[key]) && pricing[key] >= 0)) return null;
  if (!Number.isInteger(usage.input) || !Number.isInteger(usage.output)) return null;
  const cached = usage.cachedInput ?? 0;
  if (cached > usage.input) throw new Error("Cached input exceeds input tokens");
  return ((usage.input - cached) * pricing.inputPerMillion + cached * pricing.cachedInputPerMillion
    + usage.output * pricing.outputPerMillion) / 1_000_000;
}

export function buildCatalog({ cards, runs, pricing = {} }) {
  if (!Array.isArray(cards) || !Array.isArray(runs)) throw new Error("Cards and runs must be arrays");
  const models = cards.map((card) => ({
    id: card.id ?? card.candidate?.id,
    modelId: card.model?.modelId ?? card.candidate?.modelId ?? null,
    runtime: card.deployment?.runtime ?? card.candidate?.backend ?? "unknown",
    status: card.status ?? "declared",
  }));
  if (models.some((model) => !model.id)) throw new Error("Model card missing ID");
  const benchmarkRuns = runs.map((run) => {
    if (!run.id || !run.modelId || !run.benchmarkId || !run.status)
      throw new Error("Run requires id, modelId, benchmarkId, status");
    const price = pricing[run.pricingId];
    return { ...run, estimatedCostUsd: calculateCost(run.usage ?? {}, price),
      pricingSource: price?.source ?? null };
  });
  return { schemaVersion: 1, models, benchmarkRuns,
    capabilityAssessments: [], note: "No inferred capabilities; only supplied evidence" };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const args = process.argv.slice(2);
  const get = (flag) => { const i = args.indexOf(flag); return i < 0 ? null : args[i + 1]; };
  const cardsPath = get("--cards"), runsPath = get("--runs"), output = get("--output");
  if (!cardsPath || !runsPath || !output) {
    console.error("Usage: node scripts/export-model-capability-catalog.mjs --cards cards.json --runs runs.json --output catalog.json [--pricing pricing.json]");
    process.exitCode = 1;
  } else {
    try {
      const read = (p) => JSON.parse(readFileSync(p, "utf8"));
      const catalog = buildCatalog({ cards: read(cardsPath), runs: read(runsPath),
        pricing: get("--pricing") ? read(get("--pricing")) : {} });
      mkdirSync(path.dirname(output), { recursive: true });
      writeFileSync(output, JSON.stringify(catalog, null, 2) + "\n");
      console.log(`Wrote ${output}`);
    } catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}
