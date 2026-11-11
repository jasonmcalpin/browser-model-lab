#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { CURRENT_PRODUCTION_SCORER_REVISION, rescoreProductionFitness } from "./browser-ai-rescore-lib.mjs";

const source = process.argv.slice(2).find((arg) => arg !== "--");
if (!source) {
  process.stderr.write("Usage: pnpm benchmark:browser-ai:rescore -- <artifact.json>\n");
  process.exitCode = 1;
} else {
  try {
    const sourcePath = path.resolve(source);
    const artifact = JSON.parse(readFileSync(sourcePath, "utf8"));
    const candidates = artifact.candidates.map((candidate) => candidate.productionFitness
      ? { ...candidate, productionFitness: rescoreProductionFitness(candidate.productionFitness) }
      : candidate);
    const derived = {
      ...artifact,
      candidates,
      derivedFrom: path.basename(sourcePath),
      rescoredAt: new Date().toISOString(),
      rescoreRevision: CURRENT_PRODUCTION_SCORER_REVISION,
      originalManifest: artifact.manifest ?? null,
    };
    const parsed = path.parse(sourcePath);
    let outputPath = path.join(parsed.dir, `${parsed.name}.rescored.json`);
    for (let suffix = 2; existsSync(outputPath); suffix += 1)
      outputPath = path.join(parsed.dir, `${parsed.name}.rescored-${suffix}.json`);
    writeFileSync(outputPath, JSON.stringify(derived, null, 2) + "\n", { flag: "wx" });
    process.stdout.write(`Rescored artifact: ${outputPath}\n`);
  } catch (error) {
    process.stderr.write(`Unable to rescore artifact: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
