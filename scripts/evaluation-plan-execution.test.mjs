import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("evaluation plan execution", () => {
  it("honors the machine set in the plan when dispatching actual jobs", () => {
    const sandbox = mkdtempSync(path.join(os.tmpdir(), "bml-plan-dispatch-"));
    const planId = "machine-test-" + process.pid;
    const planPath = path.join(root, "plans", planId + ".json");
    const checkpoint = path.join(root, "docs", "benchmarks", "plans", planId + "-latest.json");
    try {
      const template = JSON.parse(readFileSync(path.join(root, "plans", "vision-template.json"), "utf8"));
      const plan = {
        ...template, id: planId,
        execution: { ...template.execution, machine: "explicit-machine-from-plan", maxJobs: 100 },
      };
      writeFileSync(planPath, JSON.stringify(plan, null, 2) + "\n");
      const capture = path.join(sandbox, "captured.jsonl");
      const mockPnpm = path.join(sandbox, "pnpm");
      writeFileSync(mockPnpm, `#!/usr/bin/env node
const fs = require("node:fs");
fs.appendFileSync(process.env.BML_CAPTURE, JSON.stringify(process.argv.slice(2)) + "\\n");
`);
      chmodSync(mockPnpm, 0o755);
      const result = spawnSync(process.execPath, [
        path.join(root, "scripts", "run-evaluation-plan.mjs"), "--", "--plan",
        path.relative(root, planPath),
      ], {
        cwd: root, encoding: "utf8",
        env: { ...process.env, PATH: sandbox + path.delimiter + process.env.PATH, BML_CAPTURE: capture },
        timeout: 30_000,
      });
      assert.equal(result.status, 0, result.stdout + "\n" + result.stderr);
      assert.match(result.stdout, /"machine": "explicit-machine-from-plan"/);
      const commands = readFileSync(capture, "utf8").trim().split("\n").map(line => JSON.parse(line));
      assert.ok(commands.length > 0, "The plan must launch its jobs, not just perform a dry run.");
      for (const command of commands) {
        assert.equal(command[command.indexOf("--machine") + 1], "explicit-machine-from-plan");
        assert.ok(command.includes("--vision-cases"));
        const cases = JSON.parse(command[command.indexOf("--vision-cases") + 1]);
        assert.equal(cases.length, 12);
      }
      assert.ok(existsSync(checkpoint));
      const recorded = JSON.parse(readFileSync(checkpoint, "utf8"));
      assert.equal(recorded.machine, "explicit-machine-from-plan");
      assert.equal(recorded.results.length, commands.length);
      assert.ok(recorded.results.every(entry => entry.exitCode === 0));
    } finally {
      rmSync(planPath, { force: true });
      rmSync(checkpoint, { force: true });
      rmSync(sandbox, { recursive: true, force: true });
    }
  });
});
