import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

const LIMIT = 500;
const DEFAULT_MATRIX = { maxNewTokens: [256] };
const SUITES = new Set(["production", "advanced", "character", "t1", "t2"]);
const RUNTIMES = new Set(["browser", "node"]);
const MODES = new Set(["headless", "headful"]);
const MEMORY = new Set(["rolling", "full", "recent", "none"]);
const acceptedFields = new Set(["maxNewTokens", "temperature", "memoryStrategy"]);
const fail = (message) => { throw new Error("Invalid evaluation plan: " + message); };

function object(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(name + " must be an object.");
  return value;
}
function onlyKeys(value, allowed, name) {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(name + " has unsupported key " + key);
}
function uniqueStrings(value, label, allowed) {
  if (!Array.isArray(value) || !value.length || value.some(x => typeof x !== "string" || !allowed.has(x)))
    fail(label + " must be a nonempty list of supported values.");
  if (new Set(value).size !== value.length) fail(label + " must not contain duplicates.");
  return value;
}
function integer(value, low, high, label) {
  if (!Number.isInteger(value) || value < low || value > high) fail(label + " must be an integer between " + low + " and " + high);
  return value;
}
function matrixValues(matrix, name, allowed) {
  const values = matrix[name];
  if (!Array.isArray(values) || !values.length || values.some(value => !allowed(value))) fail("matrix." + name + " has invalid values.");
  if (new Set(values.map(String)).size !== values.length) fail("matrix." + name + " duplicates values.");
  return values;
}
export function validateEvaluationPlan(value) {
  const p = object(value, "root");
  onlyKeys(p, ["schemaVersion", "id", "models", "execution", "suites", "matrix", "output"], "root");
  if (p.schemaVersion !== 1 || !/^[a-z0-9][a-z0-9._-]{0,79}$/.test(p.id ?? ""))
    fail("schemaVersion must be 1 and id must be a safe stable identifier.");
  const models = object(p.models, "models");
  onlyKeys(models, ["cardsDir", "select"], "models");
  if (typeof models.cardsDir !== "string" || !models.cardsDir || path.isAbsolute(models.cardsDir)
    || models.cardsDir.split(/[\\/]/).includes("..")) fail("models.cardsDir must stay within the repository.");
  if (models.select !== "all" && (!Array.isArray(models.select) || !models.select.length
    || models.select.some(x => typeof x !== "string" || !/^[a-zA-Z0-9._-]+$/.test(x))
    || new Set(models.select).size !== models.select.length)) fail("models.select must be all or unique model IDs.");
  const exec = object(p.execution, "execution");
  onlyKeys(exec, ["runtime", "mode", "cache", "trials", "maxJobs"], "execution");
  uniqueStrings(exec.runtime, "execution.runtime", RUNTIMES);
  if (!MODES.has(exec.mode)) fail("execution.mode must be headless or headful.");
  if (!["reuse", "cold"].includes(exec.cache)) fail("execution.cache must be reuse or cold.");
  integer(exec.trials, 1, 20, "execution.trials");
  integer(exec.maxJobs ?? LIMIT, 1, 5000, "execution.maxJobs");
  uniqueStrings(p.suites, "suites", SUITES);
  const matrix = object(p.matrix ?? DEFAULT_MATRIX, "matrix");
  if (!Object.keys(matrix).length) fail("matrix must contain at least one dimension.");
  for (const key of Object.keys(matrix)) {
    if (!acceptedFields.has(key)) fail("unsupported matrix axis " + key);
  }
  for (const key of Object.keys(matrix)) {
    if (key === "maxNewTokens") matrixValues(matrix, key, x => Number.isInteger(x) && x >= 64 && x <= 1536);
    else if (key === "temperature") matrixValues(matrix, key, x => typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= 2);
    else if (key === "memoryStrategy") matrixValues(matrix, key, x => MEMORY.has(x));
  }
  const output = object(p.output, "output");
  onlyKeys(output, ["retainTranscripts", "publishCatalog", "directory"], "output");
  if (typeof output.retainTranscripts !== "boolean" || typeof output.publishCatalog !== "boolean")
    fail("output flags must be boolean.");
  if (output.directory !== undefined && (typeof output.directory !== "string"
    || !output.directory.trim() || path.isAbsolute(output.directory)
    || output.directory.split(/[\\/]/).includes(".."))) fail("output.directory must be repository relative.");
  return p;
}
function combinations(matrix) {
  return Object.entries(matrix).reduce((all, [key, values]) =>
    all.flatMap(row => values.map(value => ({ ...row, [key]: value }))), [{}]);
}
export function expandEvaluationPlan(plan, candidateIds) {
  const p = validateEvaluationPlan(plan);
  const available = new Set(candidateIds);
  const selected = p.models.select === "all" ? candidateIds : p.models.select;
  if (!selected.length) fail("models.cardsDir contains no candidates.");
  for (const id of selected) if (!available.has(id)) fail("selected model not in cardsDir: " + id);
  const configs = combinations(p.matrix ?? DEFAULT_MATRIX);
  const count = selected.length * p.execution.runtime.length * p.suites.length * configs.length * p.execution.trials;
  if (count > (p.execution.maxJobs ?? LIMIT)) fail("expanded workload " + count + " exceeds maxJobs.");
  const jobs = [];
  for (const model of selected) for (const runtime of p.execution.runtime)
    for (const suite of p.suites) for (const parameters of configs)
      for (let trial = 1; trial <= p.execution.trials; trial++) {
        const unsupported = [];
        if (suite === "character") unsupported.push("dedicated character runner not yet implemented");
        if ("temperature" in parameters) unsupported.push("CLI temperature sweep requires request-scoped suite support");
        if ("memoryStrategy" in parameters) unsupported.push("memory strategy sweep requires character suite support");
        if (runtime === "node" && p.execution.mode === "headful") unsupported.push("node runtime cannot be headful");
        if (runtime === "node" && p.execution.cache === "cold") unsupported.push("node cold-cache reset unsupported");
        if (p.output.publishCatalog === false) unsupported.push("current benchmark CLIs automatically refresh catalog");
        if (p.output.retainTranscripts === false) unsupported.push("current benchmark artifacts always retain raw transcripts");
        if (suite === "production" && "maxNewTokens" in parameters && parameters.maxNewTokens !== 256)
          unsupported.push("production suite output cap is fixed at 256; this axis does not change it");
        if (!["production", "character"].includes(suite) && "maxNewTokens" in parameters
          && ![256, 512, 768].includes(parameters.maxNewTokens))
          unsupported.push("current advanced suite supports 256/512/768 only");
        const job = { model, runtime, suite, parameters, trial, blocked: unsupported };
        jobs.push({ ...job, id: createHash("sha256").update(JSON.stringify(job)).digest("hex").slice(0, 16) });
      }
  return {
    planId: p.id, planVersion: 1,
    digest: createHash("sha256").update(JSON.stringify(p)).digest("hex"),
    cardsDir: p.models.cardsDir,
    count: jobs.length, runnable: jobs.filter(job => !job.blocked.length).length,
    blocked: jobs.filter(job => job.blocked.length).length,
    jobs,
  };
}
export function readEvaluationPlan(repoRoot, filename) {
  const absolute = path.resolve(repoRoot, filename);
  if (!absolute.startsWith(repoRoot + path.sep)) fail("plan must be inside the repository.");
  return validateEvaluationPlan(JSON.parse(readFileSync(absolute, "utf8")));
}
