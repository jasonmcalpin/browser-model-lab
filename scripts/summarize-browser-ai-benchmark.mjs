#!/usr/bin/env node
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { formatBrowserAiSummary } from "./browser-ai-benchmark-cli-lib.mjs";

const file = process.argv.slice(2).find((argument) => argument !== "--");
if (!file) {
  process.stderr.write("Usage: pnpm benchmark:browser-ai:summary -- <artifact.json>\n");
  process.exitCode = 1;
} else {
  try {
    const artifact = JSON.parse(readFileSync(path.resolve(file), "utf8"));
    process.stdout.write(formatBrowserAiSummary(artifact, { machine: os.hostname().split(".")[0] }));
  } catch (error) {
    process.stderr.write(`Unable to summarize benchmark artifact: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
