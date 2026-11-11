#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { automationExitCode, browserAiArtifactBasename, browserAiQuery,
  formatBrowserAiSummary, mergeBrowserAiArtifacts, parseBrowserAiCliArgs, uniqueArtifactPath } from "./browser-ai-benchmark-cli-lib.mjs";
import { loadModelCardInventory } from "./model-card-inventory.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const usage = `Usage: pnpm benchmark:browser-ai -- [options]

  --machine <label>       Artifact machine label (default: hostname)
  --candidate <id|all>    Candidate selector (default: Qwen3-0.6B control)
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

async function waitForServer(url, child, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Development server exited with code ${child.exitCode}.`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch { /* Server is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Timed out waiting for the development server.");
}

function gitCommit() {
  const result = spawnSync("git", ["rev-parse", "--short=12", "HEAD"], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`Unable to resolve Git commit: ${result.stderr.trim()}`);
  const status = spawnSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" });
  if (status.status !== 0) throw new Error(`Unable to inspect Git status: ${status.stderr.trim()}`);
  return `${result.stdout.trim()}${status.stdout.trim() ? "-dirty" : ""}`;
}

async function waitForAutomation(page, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastDetail;
  while (Date.now() < deadline) {
    const state = await page.evaluate(() => window.__browserAiBenchmarkV2Automation);
    if (state?.status === "complete" || state?.status === "failed") return state;
    if (state?.status === "running" && state.detail && state.detail !== lastDetail) {
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
  const inventory = loadModelCardInventory(root);
  const options = parseBrowserAiCliArgs(process.argv.slice(2), {
    machine: os.hostname().split(".")[0],
    outputDir: "docs/benchmarks/runs",
    profileDir: ".artifacts/browser-ai-benchmark-profile",
  }, inventory);
  if (options.help) { process.stdout.write(usage); return; }

  const port = options.port || await freePort();
  const commit = gitCommit();
  const origin = `http://127.0.0.1:${port}`;
  const server = spawn("pnpm", ["dev", "--", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, BROWSER: "none" },
  });
  let serverErrors = "";
  server.stderr.on("data", (chunk) => { serverErrors = `${serverErrors}${chunk}`.slice(-8_000); });
  server.stdout.on("data", () => { /* Vite output is intentionally quiet; benchmark progress is authoritative. */ });

  let context;
  try {
    await waitForServer(origin, server);
    const profileDir = path.resolve(root, options.profileDir);
    mkdirSync(profileDir, { recursive: true });
    context = await chromium.launchPersistentContext(profileDir, {
      channel: "chrome",
      headless: !options.headful,
      args: ["--enable-unsafe-webgpu"],
      viewport: { width: 1440, height: 1000 },
    });

    for (const page of context.pages()) await page.close();
    const selectedCandidates = options.candidate === "all" ? inventory.candidateIds : [options.candidate];
    const artifacts = [];
    for (const candidate of selectedCandidates) {
      process.stdout.write(`Running ${candidate} (${options.test}, budget ${options.budget}, ${options.cacheMode})\n`);
      const page = await context.newPage();
      try {
        const query = browserAiQuery(options, candidate, commit);
        await page.goto(`${origin}/?${query}`, { waitUntil: "domcontentloaded" });
        const state = await waitForAutomation(page, options.timeoutMs);
        if (automationExitCode(state) !== 0) throw new Error(state.error || "Browser automation failed.");
        artifacts.push(state.artifact);
      } finally {
        await page.close();
      }
    }

    const artifact = mergeBrowserAiArtifacts(artifacts);
    const outputDir = path.resolve(root, options.outputDir);
    mkdirSync(outputDir, { recursive: true });
    const basename = browserAiArtifactBasename({ timestamp: new Date(), machine: options.machine, commit });
    const artifactPath = uniqueArtifactPath(outputDir, basename, existsSync);
    writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    const summary = formatBrowserAiSummary(artifact, { machine: options.machine, commit });
    const summaryPath = artifactPath.replace(/\.json$/, ".md");
    writeFileSync(summaryPath, summary, { encoding: "utf8", flag: "wx" });
    process.stdout.write(`\n${summary}\nArtifact: ${path.relative(root, artifactPath)}\nSummary: ${path.relative(root, summaryPath)}\n`);
  } catch (error) {
    const detail = serverErrors.trim();
    throw new Error(`${error instanceof Error ? error.message : String(error)}${detail ? `\nDevelopment server stderr:\n${detail}` : ""}`);
  } finally {
    if (context) await context.close();
    await stopChild(server);
  }
}

main().catch((error) => {
  process.stderr.write(`Browser AI benchmark automation failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
