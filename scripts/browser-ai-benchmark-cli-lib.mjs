import path from "node:path";

const TESTS = new Set(["production", "advanced", "t1", "t2", "vision", "all"]);
const BUDGETS = new Set(["256", "512", "768", "all"]);

function valueAfter(args, index, name) {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value.`);
  return value;
}

export function cardsDirFromArgs(args, fallback = "testing") {
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== "--cards-dir") continue;
    return valueAfter(args, index, "--cards-dir");
  }
  return fallback;
}

export function parseBrowserAiCliArgs(args, defaults = {}, inventory = {}) {
  const candidateIds = inventory.candidateIds ?? [];
  if (!candidateIds.length) throw new Error("No model cards are available in the selected folder.");
  const candidates = new Set([...candidateIds, "all"]);
  const result = {
    machine: defaults.machine ?? "unlabeled",
    candidate: "all",
    cardsDir: defaults.cardsDir ?? "testing",
    test: "all",
    budget: "all",
    cacheMode: "cached",
    liveWikipedia: false,
    headful: false,
    timeoutMs: defaults.timeoutMs ?? 30 * 60 * 1000,
    outputDir: defaults.outputDir ?? "docs/benchmarks/runs",
    profileDir: defaults.profileDir ?? ".artifacts/browser-ai-benchmark-profile",
    port: defaults.port ?? 0,
    help: false,
    quiet: false,
    visionCases: undefined,
  };
  let cacheFlag;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--") continue;
    if (["--machine", "--candidate", "--cards-dir", "--test", "--budget", "--timeout-ms", "--output-dir",
      "--profile-dir", "--port", "--vision-cases"].includes(argument)) {
      const value = valueAfter(args, index, argument);
      index += 1;
      if (argument === "--machine") result.machine = value;
      if (argument === "--candidate") result.candidate = value;
      if (argument === "--cards-dir") result.cardsDir = value;
      if (argument === "--test") result.test = value;
      if (argument === "--budget") result.budget = value;
      if (argument === "--timeout-ms") result.timeoutMs = Number(value);
      if (argument === "--output-dir") result.outputDir = value;
      if (argument === "--profile-dir") result.profileDir = value;
      if (argument === "--port") result.port = Number(value);
      if (argument === "--vision-cases") result.visionCases = JSON.parse(value);
      continue;
    }
    if (argument === "--cold" || argument === "--cached") {
      if (cacheFlag) throw new Error("Choose only one of --cold or --cached.");
      cacheFlag = argument;
      result.cacheMode = argument === "--cold" ? "cold" : "cached";
      continue;
    }
    if (argument === "--live-wikipedia") { result.liveWikipedia = true; continue; }
    if (argument === "--headful") { result.headful = true; continue; }
    if (argument === "--help" || argument === "-h") { result.help = true; continue; }
    if (argument === "--quiet") { result.quiet = true; continue; }
    throw new Error(`Unknown argument: ${argument}`);
  }
  if (!/^[A-Za-z0-9._-]{1,80}$/.test(result.machine)) throw new Error("Machine label must use 1-80 letters, numbers, dots, underscores, or hyphens.");
  if (!candidates.has(result.candidate)) throw new Error(`Unknown candidate: ${result.candidate}`);
  if (!TESTS.has(result.test)) throw new Error(`Unknown test: ${result.test}`);
  if (!BUDGETS.has(result.budget)) throw new Error(`Unknown budget: ${result.budget}`);
  if (result.liveWikipedia && result.candidate === "all") throw new Error("--live-wikipedia requires one candidate.");
  if (!Number.isInteger(result.timeoutMs) || result.timeoutMs <= 0) throw new Error("--timeout-ms must be a positive integer.");
  if (!Number.isInteger(result.port) || result.port < 0 || result.port > 65535) throw new Error("--port must be 0 or a valid TCP port.");
  return result;
}

export function browserAiQuery(options, candidate = options.candidate, revision = "uncommitted-browser-session", modelCard) {
  const parameters = new URLSearchParams({
    "browser-ai-benchmark": "1",
    autorun: "1",
    candidate,
    test: options.test,
    budget: options.budget,
    cache: options.cacheMode,
    machine: options.machine,
    revision,
  });
  if (options.liveWikipedia) parameters.set("live-wikipedia", "1");
  if (options.visionCases) parameters.set("vision-cases", JSON.stringify(options.visionCases));
  if (modelCard) parameters.set("model-card", JSON.stringify(modelCard));
  return parameters.toString();
}

function compactTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid artifact timestamp.");
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function safeSegment(value, label) {
  const safe = String(value).trim().replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!safe) throw new Error(`Invalid ${label}.`);
  return safe;
}

export function browserAiArtifactBasename({ timestamp, machine, commit }) {
  return `${compactTimestamp(timestamp)}_${safeSegment(machine, "machine")}_${safeSegment(commit, "commit")}.json`;
}

export function uniqueArtifactPath(directory, basename, exists) {
  const parsed = path.parse(basename);
  let candidate = path.join(directory, basename);
  for (let suffix = 2; exists(candidate); suffix += 1)
    candidate = path.join(directory, `${parsed.name}_${suffix}${parsed.ext}`);
  return candidate;
}

export function automationExitCode(state) {
  return state?.status === "complete" ? 0 : 1;
}

export function mergeBrowserAiArtifacts(artifacts) {
  if (!artifacts.length) throw new Error("No browser benchmark artifacts were collected.");
  const [first, ...rest] = artifacts;
  for (const artifact of rest) {
    if (artifact.schemaVersion !== first.schemaVersion || artifact.suite !== first.suite
      || JSON.stringify(artifact.settings) !== JSON.stringify(first.settings))
      throw new Error("Browser benchmark artifacts use incompatible contracts.");
  }
  const ids = new Set();
  const candidates = artifacts.flatMap((artifact) => artifact.candidates).filter((candidate) => {
    if (ids.has(candidate.candidateId)) return false;
    ids.add(candidate.candidateId);
    return true;
  });
  return {
    ...first,
    generatedAt: artifacts.map((artifact) => artifact.generatedAt).sort().at(-1),
    candidates,
    ...(artifacts.find((artifact) => artifact.liveWikipediaSmoke)?.liveWikipediaSmoke
      ? { liveWikipediaSmoke: artifacts.find((artifact) => artifact.liveWikipediaSmoke).liveWikipediaSmoke } : {}),
  };
}

function result(value) { return value ? "PASS" : "FAIL"; }

export function formatBrowserAiSummary(artifact, metadata = {}) {
  const lines = [
    "# Browser AI Benchmark V2 Run Summary",
    "",
    `- Generated: ${artifact.generatedAt}`,
    `- Machine: ${metadata.machine ?? "unlabeled"}`,
    `- Commit: ${metadata.commit ?? "unknown"}`,
    `- WebGPU device: ${(artifact.webGpuCapabilities?.deviceAcquired ?? artifact.environment?.webgpu) ? "ready" : "unavailable"}`,
    "",
    "| Candidate | Runtime | Compatibility | Validity | Vision | Envelope | Production | G1 | 256 | 512 | 768 | Failures |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const candidate of artifact.candidates) {
    const budget = (key) => {
      const entry = candidate.advancedAgent?.budgets?.[key];
      if (!entry) return "not run";
      const parts = [];
      if (entry.gates) parts.push(`G2 ${result(entry.gates.g2.passed)} / G3 ${result(entry.gates.g3.passed)}`);
      if (entry.t1) parts.push(`T1 ${result(entry.t1.passed)}`);
      if (entry.t2) parts.push(`T2 ${entry.t2.score}/20`);
      return parts.join("; ") || entry.status;
    };
    const envelope = candidate.operatingEnvelope?.summary;
    lines.push(`| ${candidate.candidateId} | ${candidate.pipelineTask ?? "unknown"} / ${candidate.dtype ?? "unknown"} | ${candidate.compatibilityQualification?.state ?? "unreported"} | ${candidate.validity ?? "unreported"} | ${candidate.visionCapability ? `${candidate.visionCapability.score}/${candidate.visionCapability.maximum}` : "n/a"} | ${envelope
      ? `${envelope.hardRequirementsMet}/${envelope.knownHardRequirements} hard; ${envelope.unknownCount} unknown`
      : "unreported"} | ${candidate.productionFitness
      ? `${candidate.productionFitness.score}/${candidate.productionFitness.maximum}` : "not run"} | ${candidate.advancedAgent?.g1?.status === "not-run"
      || candidate.advancedAgent?.g1?.output === undefined
      ? "not run" : result(candidate.advancedAgent.g1.passed)} | ${budget("256")} | ${budget("512")} | ${budget("768")} | ${candidate.failures?.map((failure) => failure.phase).join(", ") || "none"} |`);
  }
  const diagnosed = artifact.candidates.filter((candidate) => candidate.diagnostics);
  if (diagnosed.length) {
    lines.push("", "## Role and failure diagnostics", "");
    for (const candidate of diagnosed) {
      const roles = candidate.diagnostics.roles
        .map((role) => `${role.id}=${role.rating}(${role.score}/${role.maximum})`).join("; ");
      const reasonCounts = new Map();
      for (const failure of candidate.diagnostics.failures)
        for (const reason of failure.reasons) reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
      const failures = [...reasonCounts.entries()].sort((left, right) => right[1] - left[1])
        .map(([reason, count]) => `${reason}×${count}`).join(", ") || "none";
      const probes = candidate.diagnosticProbes
        ? `${candidate.diagnosticProbes.cases.filter((entry) => entry.passed).length}/${candidate.diagnosticProbes.cases.length}`
        : "not run";
      lines.push(`- **${candidate.candidateId}** — probes ${probes}; ${roles}; failure dimensions: ${failures}`);
    }
  }
  if (artifact.liveWikipediaSmoke)
    lines.push("", `Live Wikipedia: ${result(artifact.liveWikipediaSmoke.passed)}`);
  return `${lines.join("\n")}\n`;
}
