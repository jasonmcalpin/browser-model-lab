#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { automationExitCode, browserAiArtifactBasename, browserAiQuery, cardsDirFromArgs,
  formatBrowserAiSummary, formatVisionQualification, mergeBrowserAiArtifacts, parseBrowserAiCliArgs, uniqueArtifactPath } from "./browser-ai-benchmark-cli-lib.mjs";
import { loadModelCardInventory } from "./model-card-inventory.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const usage = `Usage: pnpm benchmark:browser-ai -- [options]

  --vision-cases <json>    Selected and validated vision fixture cases (used by plans)
  --quiet                Suppress verbose test logs; print compact results and evidence paths
  --skip-catalog         Defer catalog generation to plan orchestrator
  --revision <sha>      Source revision captured by plan orchestrator
  --machine <label>       Artifact machine label (default: hostname)
  --cards-dir <path>      Model-card folder (default: testing)
  --candidate <id|all>    Candidate selector within folder (default: all)
  --test <name>           production|advanced|t1|t2|all
  --budget <value>        256|512|768|all
  --cold | --cached       Clear candidate cache or reuse it (default: cached)
  --live-wikipedia        Add the unranked live smoke; requires one candidate
  --headful               Show Chrome instead of using headless mode
  --timeout-ms <number>   Per-candidate automation timeout
  --output-dir <path>     Run artifact directory
  --profile-dir <path>    Persistent Chrome profile directory
  --port <number>         Vite port; 0 chooses an available port
`;

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : undefined;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function waitForServer(url, child, logs, timeoutMs = 60_000) {
  const startupError = new Promise((_, reject) => {
    child.once("error", (error) => reject(new Error(`Development server failed to start: ${error.message}`)));
  });
  const polling = (async () => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (child.exitCode !== null)
        throw new Error(`Development server exited with code ${child.exitCode}.\n${logs.text()}`);
      try {
        const response = await fetch(url);
        if (response.ok) return;
      } catch { /* Server is still starting. */ }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`Timed out waiting for the development server.\n${logs.text()}`);
  })();
  return Promise.race([polling, startupError]);
}

function gitCommit() {
  const result = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`Unable to resolve Git commit: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

function refreshModelRuntimeCatalog(commit) {
  const script = path.resolve(root, "scripts/export-model-capability-catalog.mjs");
  const result = spawnSync(process.execPath, [script, "--source-revision", commit], {
    cwd: root, encoding: "utf8",
  });
  if (result.status !== 0)
    throw new Error(`Benchmark artifact was written, but model-runtime catalog materialization failed: ${result.stderr.trim()}`);
  if (result.stdout.trim()) process.stdout.write(`${result.stdout.trim()}\n`);
}

async function waitForAutomation(page, timeoutMs, quiet = false) {
  const deadline = Date.now() + timeoutMs;
  let lastDetail;
  while (Date.now() < deadline) {
    const state = await page.evaluate(() => window.__browserAiBenchmarkV2Automation);
    if (state?.status === "complete" || state?.status === "failed") return state;
    if (state?.status === "running" && state.detail && state.detail !== lastDetail) {
      if (!quiet) process.stdout.write(`  ${state.detail}\n`);
      else if (/image fixture evaluations|multimodal vision capability/i.test(state.detail))
        process.stdout.write(`  ${state.detail}\n`);
      lastDetail = state.detail;
    }
    await page.waitForTimeout(500);
  }
  throw new Error(`Timed out after ${timeoutMs} ms waiting for browser automation.`);
}

async function stopChild(child) {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 3_000)),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

async function main() {
  const cliArgs = process.argv.slice(2);
  const cardsDir = cardsDirFromArgs(cliArgs, "testing");
  const inventory = loadModelCardInventory(root, cardsDir);
  const options = parseBrowserAiCliArgs(cliArgs, {
    machine: os.hostname().split(".")[0],
    outputDir: "docs/benchmarks/runs",
    profileDir: ".artifacts/browser-ai-benchmark-profile",
    cardsDir,
  }, inventory);
  if (options.help) { process.stdout.write(usage); return; }

  const port = options.port || await freePort();
  const commit = options.revision ?? gitCommit();
  const origin = `http://127.0.0.1:${port}`;
  const server = spawn("pnpm", ["exec", "vite", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, BROWSER: "none" },
  });
  let serverOutput = "";
  const appendServerOutput = (chunk) => { serverOutput = `${serverOutput}${chunk}`.slice(-12_000); };
  server.stderr.on("data", appendServerOutput);
  server.stdout.on("data", appendServerOutput);
  const serverLogs = {
    text: () => serverOutput.trim() ? `Development server output:\n${serverOutput.trim()}` : "Development server produced no output.",
  };

  let context;
  try {
    await waitForServer(origin, server, serverLogs);
    const profileDir = path.resolve(root, options.profileDir);
    mkdirSync(profileDir, { recursive: true });
    context = await chromium.launchPersistentContext(profileDir, {
      channel: "chrome",
      headless: !options.headful,
      args: ["--enable-unsafe-webgpu"],
      viewport: { width: 1440, height: 1000 },
    });

    for (const page of context.pages()) await page.close();
    const selectedCards = options.candidate === "all"
      ? inventory.cards
      : [inventory.cards.find((card) => card.candidate.id === options.candidate)].filter(Boolean);
    const artifacts = [];
    for (const modelCard of selectedCards) {
      const candidate = modelCard.candidate.id;
      if (!options.quiet) process.stdout.write(`Running ${candidate} from ${options.cardsDir} (${options.test}, budget ${options.budget}, ${options.cacheMode})\n`);
      const page = await context.newPage();
      try {
        const query = browserAiQuery(options, candidate, commit, modelCard);
        await page.goto(`${origin}/?${query}`, { waitUntil: "domcontentloaded" });
        const state = await waitForAutomation(page, options.timeoutMs, options.quiet);
        if (automationExitCode(state) !== 0) throw new Error(state.error || "Browser automation failed.");
        artifacts.push(state.artifact);
      } finally {
        await page.close();
      }
    }

    const artifact = mergeBrowserAiArtifacts(artifacts);
    const outputDir = path.resolve(root, options.outputDir);
    mkdirSync(outputDir, { recursive: true });
    const basename = browserAiArtifactBasename({ timestamp: new Date(), machine: options.machine, commit,
      model: artifact.candidates.length === 1 ? artifact.candidates[0].candidateId : undefined });
    const artifactPath = uniqueArtifactPath(outputDir, basename, existsSync);
    writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    const summary = formatBrowserAiSummary(artifact, { machine: options.machine, commit });
    const summaryPath = artifactPath.replace(/\.json$/, ".md");
    writeFileSync(summaryPath, summary, { encoding: "utf8", flag: "wx" });
    if (!options.skipCatalog) refreshModelRuntimeCatalog(commit);
    if (options.quiet) {
      for (const candidate of artifact.candidates) {
        const vision = candidate.visionCapability;
        const visionStatus = formatVisionQualification(vision);
        process.stdout.write(`Result: ${candidate.candidateId} | vision ${visionStatus} | ${candidate.validity} | ${candidate.failures.length} failures\n`);
      }
      process.stdout.write(`Artifact: ${path.relative(root, artifactPath)}\nSummary: ${path.relative(root, summaryPath)}\n`);
    } else process.stdout.write(`\n${summary}\nArtifact: ${path.relative(root, artifactPath)}\nSummary: ${path.relative(root, summaryPath)}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(message.includes("Development server output:")
      || message.includes("Development server produced no output.")
      ? message : `${message}\n${serverLogs.text()}`);
  } finally {
    if (context) await context.close();
    await stopChild(server);
  }
}

main().catch((error) => {
  process.stderr.write(`Browser AI benchmark automation failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
