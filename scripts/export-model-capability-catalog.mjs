#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const GENERATOR_VERSION = "model-runtime-catalog-v1";

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function finite(values) {
  return values.filter((value) => Number.isFinite(value));
}

function slug(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

function hostFromArtifact(artifact) {
  return /^node\//i.test(artifact.environment?.userAgent ?? "") ? "node" : "browser";
}

function engineFromArtifact(artifact) {
  if (artifact.environment?.transformersJs) return {
    name: "transformers-js",
    version: artifact.environment.transformersJs,
  };
  return { name: "unknown", version: null };
}

export function executionProfileIdentity(artifact, candidate) {
  const engine = engineFromArtifact(artifact);
  const host = hostFromArtifact(artifact);
  const accelerator = artifact.settings?.backend ?? "unknown";
  const protocol = candidate.adapter?.compatibilityProfileId ?? "unknown";
  const modelId = candidate.modelId;
  const revision = candidate.revision ?? "unknown";
  const dtype = candidate.dtype ?? "unknown";
  const id = [
    slug(modelId), slug(revision), slug(engine.name), slug(engine.version ?? "unknown"),
    host, slug(accelerator), slug(dtype), slug(protocol),
  ].join("--");
  return {
    id,
    model: { modelId, revision, family: candidate.family ?? null },
    execution: {
      engine: engine.name,
      engineVersion: engine.version,
      host,
      accelerator,
      dtype,
      pipelineTask: candidate.pipelineTask ?? null,
    },
    protocol: {
      profileId: protocol,
      adapterId: candidate.adapter?.adapterId ?? null,
      toolSupport: candidate.adapter?.toolSupportMode ?? null,
      toolCallFormat: candidate.adapter?.toolCallFormat ?? null,
      reasoningFormat: candidate.adapter?.reasoningFormat ?? null,
      structuredOutput: candidate.structuredOutput ?? null,
      generationProfiles: candidate.adapter?.profiles ?? null,
    },
  };
}

function roleSnapshot(candidate) {
  const roles = candidate.diagnostics?.roles ?? [];
  return Object.fromEntries(roles.map((role) => [role.id, {
    rating: role.rating,
    score: role.score,
    maximum: role.maximum,
  }]));
}

function observationFromArtifact(artifact, artifactRef, candidate) {
  return {
    artifact: artifactRef,
    generatedAt: artifact.generatedAt,
    benchmarkRevision: artifact.benchmarkRevision,
    suite: artifact.suite,
    scorerRevision: artifact.manifest?.scorerRevision ?? null,
    machine: artifact.machine,
    environment: artifact.environment,
    compatibility: candidate.compatibilityQualification?.state ?? null,
    validity: candidate.validity ?? null,
    productionScore: candidate.productionFitness?.score ?? null,
    productionMaximum: candidate.productionFitness?.maximum ?? null,
    roles: roleSnapshot(candidate),
    performance: {
      coldReadyMs: candidate.coldReadyMs ?? null,
      warmReadyMedianMs: candidate.warmReadyMedianMs ?? null,
      cacheBytes: candidate.cacheBytes ?? null,
      g1TtftMs: candidate.advancedAgent?.g1?.ttftMs ?? null,
      g1ModelMs: candidate.advancedAgent?.g1?.modelMs ?? null,
    },
    failures: candidate.failures ?? [],
  };
}

function summarizeCurrent(observations) {
  const latest = observations.reduce((winner, entry) =>
    !winner || String(entry.generatedAt).localeCompare(String(winner.generatedAt)) > 0 ? entry : winner, null);
  const scorerRevision = latest?.scorerRevision ?? null;
  const current = observations.filter((entry) => entry.scorerRevision === scorerRevision);
  const production = current.filter((entry) => Number.isFinite(entry.productionScore));
  const roleIds = new Set(current.flatMap((entry) => Object.keys(entry.roles)));
  const capabilities = {};
  for (const roleId of [...roleIds].sort()) {
    const samples = current.flatMap((entry) => entry.roles[roleId] ? [entry.roles[roleId]] : []);
    const latestRole = [...current].reverse().find((entry) => entry.roles[roleId])?.roles[roleId];
    const distribution = {};
    for (const sample of samples) distribution[sample.rating] = (distribution[sample.rating] ?? 0) + 1;
    capabilities[roleId] = {
      latestRating: latestRole?.rating ?? "UNMEASURED",
      latestScore: latestRole?.score ?? null,
      latestMaximum: latestRole?.maximum ?? null,
      ratingDistribution: distribution,
      sampleSize: samples.length,
    };
  }
  return {
    status: current.length ? "current" : "unqualified",
    scorerRevision,
    sampleSize: current.length,
    evidence: current.map((entry) => entry.artifact),
    compatibility: latest?.compatibility ?? null,
    validity: latest?.validity ?? null,
    production: production.length ? {
      median: median(production.map((entry) => entry.productionScore)),
      minimum: Math.min(...production.map((entry) => entry.productionScore)),
      maximum: Math.max(...production.map((entry) => entry.productionScore)),
      scaleMaximum: production[0].productionMaximum,
      sampleSize: production.length,
    } : null,
    capabilities,
    performanceByMachine: Object.fromEntries([...new Set(current.map((entry) => entry.machine))].sort().map((machine) => {
      const samples = current.filter((entry) => entry.machine === machine);
      return [machine, {
        sampleSize: samples.length,
        warmReadyMedianMs: median(finite(samples.map((entry) => entry.performance.warmReadyMedianMs))),
        coldReadyMs: median(finite(samples.map((entry) => entry.performance.coldReadyMs))),
        cacheBytes: median(finite(samples.map((entry) => entry.performance.cacheBytes))),
        g1TtftMs: median(finite(samples.map((entry) => entry.performance.g1TtftMs))),
        g1ModelMs: median(finite(samples.map((entry) => entry.performance.g1ModelMs))),
      }];
    })),
  };
}

export function buildModelRuntimeCatalog({ cards = [], artifacts = [], generatedAt = new Date().toISOString(),
  sourceRevision = null } = {}) {
  const declarations = new Map(cards.map((card) => {
    const candidate = card.candidate ?? card;
    return [candidate.id, {
      candidateId: candidate.id,
      modelId: candidate.modelId,
      revision: candidate.revision,
      family: candidate.family ?? null,
      compatibilityProfileId: candidate.compatibilityProfileId ?? null,
    }];
  }));

  const groups = new Map();
  for (const { artifact, ref } of artifacts) {
    if (!artifact || !Array.isArray(artifact.candidates)) continue;
    for (const candidate of artifact.candidates) {
      const identity = executionProfileIdentity(artifact, candidate);
      const existing = groups.get(identity.id) ?? { identity, observations: [] };
      existing.observations.push(observationFromArtifact(artifact, ref, candidate));
      groups.set(identity.id, existing);
    }
  }

  const profiles = [...groups.values()].map(({ identity, observations }) => {
    observations.sort((a, b) => String(a.generatedAt).localeCompare(String(b.generatedAt)));
    const currentQualification = summarizeCurrent(observations);
    const supersededEvidence = observations
      .filter((entry) => entry.scorerRevision !== currentQualification.scorerRevision)
      .map((entry) => entry.artifact);
    const declaration = [...declarations.values()].find((entry) =>
      entry.modelId === identity.model.modelId && entry.revision === identity.model.revision) ?? null;
    return {
      ...identity,
      model: {
        ...identity.model,
        family: identity.model.family ?? declaration?.family ?? null,
      },
      declaration,
      currentQualification,
      observationSummary: {
        totalRuns: observations.length,
        machines: [...new Set(observations.map((entry) => entry.machine))].sort(),
        firstObservedAt: observations[0]?.generatedAt ?? null,
        lastObservedAt: observations.at(-1)?.generatedAt ?? null,
        supersededEvidence,
      },
      evidence: observations.map((entry) => ({
        artifact: entry.artifact,
        generatedAt: entry.generatedAt,
        benchmarkRevision: entry.benchmarkRevision,
        scorerRevision: entry.scorerRevision,
        machine: entry.machine,
      })),
    };
  }).sort((a, b) => a.id.localeCompare(b.id));

  return {
    schemaVersion: 1,
    generatedAt,
    generatorVersion: GENERATOR_VERSION,
    sourceRevision,
    profiles,
    declaredModelsWithoutEvidence: [...declarations.values()].filter((declared) =>
      !profiles.some((profile) => profile.model.modelId === declared.modelId && profile.model.revision === declared.revision)),
  };
}

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function loadCards(root, directory) {
  const dir = path.resolve(root, directory);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => name.endsWith(".json")).sort()
    .map((name) => readJson(path.join(dir, name)));
}

function loadArtifacts(root, directory) {
  const dir = path.resolve(root, directory);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => name.endsWith(".json")).sort().map((name) => ({
    artifact: readJson(path.join(dir, name)),
    ref: path.relative(root, path.join(dir, name)).replaceAll(path.sep, "/"),
  }));
}

function arg(args, name, fallback) {
  const index = args.indexOf(name);
  return index < 0 ? fallback : args[index + 1];
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const args = process.argv.slice(2);
  const cardsDir = arg(args, "--cards-dir", "testing");
  const runsDir = arg(args, "--runs-dir", "docs/benchmarks/runs");
  const output = arg(args, "--output", "catalog/model-runtime-catalog.json");
  const sourceRevision = arg(args, "--source-revision", null);
  try {
    const catalog = buildModelRuntimeCatalog({
      cards: loadCards(root, cardsDir),
      artifacts: loadArtifacts(root, runsDir),
      sourceRevision,
    });
    const destination = path.resolve(root, output);
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, JSON.stringify(catalog, null, 2) + "\n");
    process.stdout.write(`Wrote ${path.relative(root, destination)} with ${catalog.profiles.length} execution profiles.\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
