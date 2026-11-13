#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadModelCardInventory } from "./model-card-inventory.mjs";
import { expandEvaluationPlan, readEvaluationPlan } from "./evaluation-plan-lib.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const usage = "Usage: pnpm benchmark:plan -- --plan plans/example.json [--execute] [--machine mac-m4]\nDefault is a validation/dry-run with no model loads.";
function args(argv) {
  const output = { execute: false, machine: os.hostname().split(".")[0] };
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i];
    if (value === "--" || value === "--dry-run") continue;
    if (value === "--execute") { output.execute = true; continue; }
    if (value === "--help" || value === "-h") { output.help = true; continue; }
    if (value === "--plan" || value === "--machine") {
      if (!argv[i + 1] || argv[i + 1].startsWith("--")) throw new Error(value + " requires value.");
      output[value === "--plan" ? "plan" : "machine"] = argv[++i];
      continue;
    }
    throw new Error("Unknown argument: " + value);
  }
  if (!output.help && !output.plan) throw new Error("--plan is required.");
  if (!/^[a-zA-Z0-9._-]{1,80}$/.test(output.machine)) throw new Error("Machine label is invalid.");
  return output;
}
function runProcess(command, commandArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, { cwd: repo, stdio: "inherit" });
    child.on("error", reject);
    child.on("close", code => resolve(code ?? 1));
  });
}
function planArguments(job, p, machine) {
  const options = [
    job.runtime === "node" ? "benchmark:node-ai" : "benchmark:browser-ai",
    "--", "--machine", machine,
    "--cards-dir", p.models.cardsDir,
    "--candidate", job.model,
    "--test", job.suite,
    "--cached",
  ];
  if (job.runtime === "browser" && p.execution.cache === "cold")
    options[options.length - 1] = "--cold";
  if (job.runtime === "browser" && p.execution.mode === "headful") options.push("--headful");
  if (job.suite !== "production") options.push("--budget", String(job.parameters.maxNewTokens ?? 256));
  if (p.output.directory) options.push("--output-dir", p.output.directory);
  return options;
}
async function main() {
  const options = args(process.argv.slice(2));
  if (options.help) { process.stdout.write(usage + "\n"); return; }
  const plan = readEvaluationPlan(repo, options.plan);
  const inventory = loadModelCardInventory(repo, plan.models.cardsDir);
  const expanded = expandEvaluationPlan(plan, inventory.candidateIds);
  process.stdout.write(JSON.stringify({
    id: expanded.planId, digest: expanded.digest, jobs: expanded.count,
    runnable: expanded.runnable, blocked: expanded.blocked,
    matrix: plan.matrix, suites: plan.suites, runtimes: plan.execution.runtime,
  }, null, 2) + "\n");
  for (const job of expanded.jobs)
    process.stdout.write(`${job.id} ${job.model} ${job.runtime} ${job.suite} ${JSON.stringify(job.parameters)} trial=${job.trial}${job.blocked.length ? " BLOCKED: " + job.blocked.join("; ") : ""}\n`);
  if (!options.execute) {
    process.stdout.write("DRY RUN — no models were loaded; use --execute after reviewing the matrix.\n");
    return;
  }
  if (expanded.blocked) throw new Error("Execution refused: " + expanded.blocked +
    " jobs cannot be represented by the current runners. Remove unsupported dimensions or implement that suite.");
  const startedAt = new Date().toISOString();
  const results = [];
  const reportDir = path.resolve(repo, "docs/benchmarks/plans");
  mkdirSync(reportDir, { recursive: true });
  for (const [index, job] of expanded.jobs.entries()) {
    process.stdout.write(`\n[${index + 1}/${expanded.count}] ${job.id} ${job.model} ${job.runtime} ${job.suite}\n`);
    const command = planArguments(job, plan, options.machine);
    const begun = Date.now();
    let exitCode = 1;
    let error;
    try { exitCode = await runProcess("pnpm", command); }
    catch (failure) { error = failure instanceof Error ? failure.message : String(failure); }
    results.push({ id: job.id, exitCode, durationMs: Date.now() - begun,
      ...(error ? { error } : {}) });
    // Write a resumable evidence pointer after every attempt, including failed ones.
    writeFileSync(path.join(reportDir, plan.id + "-latest.json"), JSON.stringify({
      schemaVersion: 1, planId: plan.id, planDigest: expanded.digest, startedAt,
      updatedAt: new Date().toISOString(), machine: options.machine,
      jobs: expanded.jobs, results, status: results.length === expanded.count ? "complete" : "partial",
    }, null, 2) + "\n");
  }
  if (results.some(result => result.exitCode !== 0)) process.exitCode = 1;
  process.stdout.write(`Plan complete: ${results.filter(x => x.exitCode === 0).length}/${results.length} successful jobs.\n`);
}
main().catch(error => {
  process.stderr.write("Evaluation plan failed: " + (error instanceof Error ? error.message : String(error)) + "\n");
  process.exitCode = 1;
});
