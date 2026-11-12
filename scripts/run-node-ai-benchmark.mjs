#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { build } from "vite";
import { browserAiArtifactBasename, cardsDirFromArgs, formatBrowserAiSummary,
  parseBrowserAiCliArgs, uniqueArtifactPath } from "./browser-ai-benchmark-cli-lib.mjs";
import { loadModelCardInventory } from "./model-card-inventory.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const usage = `Usage: pnpm benchmark:node-ai -- [options]

  --machine <label>       Artifact machine label (default: hostname)
  --cards-dir <path>      Model-card folder (default: testing)
  --candidate <id|all>    Candidate selector within folder (default: all)
  --test <name>           production|advanced|t1|t2|all
  --budget <value>        256|512|768|all
  --cached                Reuse the Transformers.js/native cache (default)
  --live-wikipedia        Add the unranked live smoke; requires one candidate
  --timeout-ms <number>   Reserved for parity with browser CLI
  --output-dir <path>     Run artifact directory

Headless Node cold-cache clearing is not defined yet; --cold is rejected.
Vision qualification is skipped in the initial Node runner.
`;

function gitCommit() {
  const result = spawnSync("git", ["rev-parse", "--short=12", "HEAD"], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`Unable to resolve Git commit: ${result.stderr.trim()}`);
  const status = spawnSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" });
  if (status.status !== 0) throw new Error(`Unable to inspect Git status: ${status.stderr.trim()}`);
  return `${result.stdout.trim()}${status.stdout.trim() ? "-dirty" : ""}`;
}

async function buildRunner() {
  const outDir = path.resolve(root, ".artifacts/node-ai-runner");
  await build({
    configFile: false,
    logLevel: "error",
    build: {
      ssr: path.resolve(root, "src/benchmark/nodeBenchmarkMain.ts"),
      outDir,
      emptyOutDir: true,
      target: "node22",
      rollupOptions: { output: { entryFileNames: "node-benchmark.mjs" } },
    },
  });
  return path.join(outDir, "node-benchmark.mjs");
}

async function main() {
  const cliArgs = process.argv.slice(2);
  const cardsDir = cardsDirFromArgs(cliArgs, "testing");
  const inventory = loadModelCardInventory(root, cardsDir);
  const options = parseBrowserAiCliArgs(cliArgs, {
    machine: os.hostname().split(".")[0],
    outputDir: "docs/benchmarks/runs",
    cardsDir,
  }, inventory);
  if (options.help) { process.stdout.write(usage); return; }
  if (options.cacheMode === "cold") throw new Error("Headless Node cold-cache clearing is not defined yet. Use --cached.");
  if (options.headful) throw new Error("--headful is browser-only and is not valid for benchmark:node-ai.");
  if (options.profileDir !== ".artifacts/browser-ai-benchmark-profile")
    throw new Error("--profile-dir is browser-only and is not valid for benchmark:node-ai.");
  if (options.port !== 0) throw new Error("--port is browser-only and is not valid for benchmark:node-ai.");

  const commit = gitCommit();
  const bundle = await buildRunner();
  const { runNodeBenchmark } = await import(`${pathToFileURL(bundle).href}?v=${Date.now()}`);
  const artifact = await runNodeBenchmark({
    cards: inventory.cards,
    candidate: options.candidate,
    test: options.test,
    budget: options.budget,
    machine: options.machine,
    benchmarkRevision: commit,
    liveWikipedia: options.liveWikipedia,
    progress: (message) => process.stdout.write(`  ${message}\n`),
  });

  const outputDir = path.resolve(root, options.outputDir);
  mkdirSync(outputDir, { recursive: true });
  const basename = browserAiArtifactBasename({ timestamp: new Date(), machine: options.machine, commit });
  const artifactPath = uniqueArtifactPath(outputDir, basename, existsSync);
  writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  const summary = formatBrowserAiSummary(artifact, { machine: options.machine, commit });
  const summaryPath = artifactPath.replace(/\.json$/, ".md");
  writeFileSync(summaryPath, summary, { encoding: "utf8", flag: "wx" });
  process.stdout.write(`\n${summary}\nArtifact: ${path.relative(root, artifactPath)}\nSummary: ${path.relative(root, summaryPath)}\n`);
}

main().catch((error) => {
  process.stderr.write(`Node AI benchmark failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
