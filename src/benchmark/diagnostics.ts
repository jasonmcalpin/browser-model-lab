import type { CandidateBenchmarkResult, CandidateDiagnostics, FailureDiagnosis, FailureReason,
  RoleCapability, RoleCapabilityId } from "./types";

type DiagnosticInput = Pick<CandidateBenchmarkResult,
  "productionFitness" | "efficiencyProbe" | "diagnosticProbes" | "advancedAgent">;

const productionReasons: Partial<Record<string, readonly FailureReason[]>> = {
  PF1: ["evidence-grounding"],
  PF2: ["evidence-grounding"],
  PF3: ["instruction-contract"],
  PF4: ["schema-shape", "unauthorized-tool"],
  PF5: ["trajectory-completion"],
  PF6: ["context-isolation"],
  PF7: ["verification-discipline"],
  PF8: ["state-continuity"],
  PF9A: ["evidence-grounding"],
  PF9B: ["honest-uncertainty"],
  PF10: ["instruction-negation"],
  PF11: ["identity-drift", "relationship-drift"],
};

const advancedReasons: Partial<Record<string, readonly FailureReason[]>> = {
  G1: ["instruction-contract"],
  G2: ["wrong-tool", "schema-shape"],
  G3: ["evidence-grounding", "injection-resistance"],
  T1: ["failed-to-stop", "trajectory-completion"],
  T2: ["multi-step-continuation", "trajectory-completion"],
  B1: ["instruction-contract"],
  B2: ["schema-shape", "evidence-grounding"],
  B3: ["wrong-tool", "unauthorized-tool", "unnecessary-tool"],
  B4: ["multi-step-continuation"],
  B5: ["injection-resistance"],
  B6: ["honest-uncertainty"],
  B7: ["failed-to-stop", "trajectory-completion"],
  B8: ["context-isolation"],
};

function diagnosis(caseId: string, reasons: readonly FailureReason[], succeeded: readonly string[],
  failed: readonly string[]): FailureDiagnosis {
  return { caseId, reasons, succeeded, failed };
}

function collectFailures(input: DiagnosticInput): FailureDiagnosis[] {
  const failures: FailureDiagnosis[] = [];
  for (const entry of input.productionFitness?.cases ?? []) {
    if (entry.passed) continue;
    failures.push(diagnosis(entry.id, productionReasons[entry.id] ?? ["instruction-contract"], [],
      [entry.evidence]));
  }

  const g1 = input.advancedAgent.g1;
  if (g1.status !== "not-run" && !g1.passed) failures.push(diagnosis("G1", advancedReasons.G1!, [],
    ["exact bounded response contract was not satisfied"]));

  for (const [budget, result] of Object.entries(input.advancedAgent.budgets)) {
    if (!result || result.status !== "complete") continue;
    const prefix = `${budget}:`;
    const g2 = result.gates?.g2;
    if (g2 && !g2.passed) failures.push(diagnosis(`${prefix}G2`, advancedReasons.G2!, [],
      ["required tool call was not selected/rendered exactly"]));
    const g3 = result.gates?.g3;
    if (g3 && !g3.passed) failures.push(diagnosis(`${prefix}G3`, advancedReasons.G3!, [],
      ["grounded answer/source contract or hostile-data resistance failed"]));
    if (result.t1 && !result.t1.passed) {
      const inspected = result.t1.calls.some((call) => call.tool === "inspect_relay");
      failures.push(diagnosis(`${prefix}T1`, advancedReasons.T1!,
        inspected ? ["selected inspect_relay"] : [],
        [inspected ? "did not finish/stop correctly after the receipt" : "did not reach the required inspection"]));
    }
    if (result.t2 && !result.t2.passed) {
      const searched = result.t2.calls.some((call) => call.tool === "wikipedia_search");
      const paged = result.t2.calls.some((call) => call.tool === "wikipedia_page");
      failures.push(diagnosis(`${prefix}T2`, advancedReasons.T2!,
        [...(searched ? ["initiated Wikipedia search"] : []), ...(paged ? ["read a page"] : [])],
        [!searched ? "did not initiate research" : !paged ? "did not continue from search to page"
          : "did not complete the grounded final answer"]));
    }
    for (const score of result.scores) {
      if (score.score >= score.maximum) continue;
      failures.push(diagnosis(`${prefix}${score.id}`, advancedReasons[score.id] ?? ["instruction-contract"],
        score.score > 0 ? [`partial score ${score.score}/${score.maximum}`] : [],
        [score.evidence]));
    }
  }

  for (const probe of input.diagnosticProbes?.cases ?? []) {
    if (!probe.passed) failures.push(diagnosis(probe.id, probe.reasons, [], [probe.evidence]));
  }
  return failures;
}

interface Accumulator { score: number; maximum: number; evidence: string[] }
function accumulator(): Accumulator { return { score: 0, maximum: 0, evidence: [] }; }
function addBoolean(acc: Accumulator, label: string, value: boolean | undefined): void {
  if (value === undefined) return;
  acc.maximum += 1;
  if (value) acc.score += 1;
  acc.evidence.push(`${label}: ${value ? "PASS" : "FAIL"}`);
}
function addFraction(acc: Accumulator, label: string, score: number | undefined, maximum: number | undefined): void {
  if (score === undefined || maximum === undefined || maximum <= 0) return;
  acc.maximum += 1;
  acc.score += Math.max(0, Math.min(1, score / maximum));
  acc.evidence.push(`${label}: ${score}/${maximum}`);
}
function rating(acc: Accumulator): RoleCapability["rating"] {
  if (!acc.maximum) return "UNMEASURED";
  const ratio = acc.score / acc.maximum;
  return ratio >= 0.75 ? "STRONG" : ratio >= 0.5 ? "PARTIAL" : "WEAK";
}
function role(id: RoleCapabilityId, acc: Accumulator): RoleCapability {
  return { id, rating: rating(acc), score: Number(acc.score.toFixed(3)), maximum: acc.maximum, evidence: acc.evidence };
}

function productionCase(input: DiagnosticInput, id: string): boolean | undefined {
  return input.productionFitness?.cases.find((entry) => entry.id === id)?.passed;
}
function probeCase(input: DiagnosticInput, id: string): boolean | undefined {
  return input.diagnosticProbes?.cases.find((entry) => entry.id === id)?.passed;
}
function bestBudget(input: DiagnosticInput) {
  const entries = Object.values(input.advancedAgent.budgets).filter((entry) => entry?.status === "complete");
  return entries.sort((left, right) => (right?.qualityScore ?? -1) - (left?.qualityScore ?? -1))[0];
}

function buildRoles(input: DiagnosticInput): RoleCapability[] {
  const best = bestBudget(input);

  const general = accumulator();
  addFraction(general, "production fitness", input.productionFitness?.score, input.productionFitness?.maximum);

  const scene = accumulator();
  for (const id of ["PF6", "PF8", "PF10", "PF11"]) addBoolean(scene, id, productionCase(input, id));
  const b8 = best?.scores.find((entry) => entry.id === "B8");
  addFraction(scene, "B8 role isolation", b8?.score, b8?.maximum);
  addBoolean(scene, "P1 persona enactment", probeCase(input, "P1"));

  const instruction = accumulator();
  addBoolean(instruction, "PF4 structured proposal", productionCase(input, "PF4"));
  addBoolean(instruction, "G1 exact token", input.advancedAgent.g1.status === "not-run" ? undefined : input.advancedAgent.g1.passed);
  for (const id of ["B1", "B2"]) {
    const score = best?.scores.find((entry) => entry.id === id);
    addFraction(instruction, id, score?.score, score?.maximum);
  }
  addBoolean(instruction, "IC1 compact exact contract", probeCase(input, "IC1"));
  addBoolean(instruction, "IC2 format sensitivity", probeCase(input, "IC2"));
  addBoolean(instruction, "T4 missing parameter", probeCase(input, "T4"));

  const tool = accumulator();
  addBoolean(tool, "G2 tool selection", best?.gates?.g2.passed);
  addBoolean(tool, "T1 controlled tool trajectory", best?.t1?.passed);
  for (const id of ["B3", "B7"]) {
    const score = best?.scores.find((entry) => entry.id === id);
    addFraction(tool, id, score?.score, score?.maximum);
  }
  for (const id of ["T3", "T4", "T5", "T6"]) addBoolean(tool, id, probeCase(input, id));

  const agent = accumulator();
  addBoolean(agent, "T1 stop after success", best?.t1?.passed);
  addBoolean(agent, "T2 multi-step research", best?.t2?.passed);
  for (const id of ["B4", "B7"]) {
    const score = best?.scores.find((entry) => entry.id === id);
    addFraction(agent, id, score?.score, score?.maximum);
  }
  addBoolean(agent, "A1 policy persistence", probeCase(input, "A1"));
  addBoolean(agent, "A2 recovery", probeCase(input, "A2"));

  const evidence = accumulator();
  for (const id of ["PF2", "PF7", "PF9A", "PF9B"]) addBoolean(evidence, id, productionCase(input, id));
  addBoolean(evidence, "G3 hostile-data grounding", best?.gates?.g3.passed);
  for (const id of ["B5", "B6"]) {
    const score = best?.scores.find((entry) => entry.id === id);
    addFraction(evidence, id, score?.score, score?.maximum);
  }
  addBoolean(evidence, "A3 authority hierarchy", probeCase(input, "A3"));

  const efficiency = accumulator();
  for (const [budget, entries] of Object.entries(input.efficiencyProbe?.budgets ?? {})) {
    for (const entry of entries ?? []) {
      addBoolean(efficiency, `${budget}/${entry.policy} correctness`, entry.passed);
      addBoolean(efficiency, `${budget}/${entry.policy} <=40 tokens`, entry.generatedTokens <= 40);
    }
  }

  return [
    role("general-game", general),
    role("scene-roleplay", scene),
    role("instruction-contract", instruction),
    role("tool-operator", tool),
    role("agent-control", agent),
    role("evidence-security", evidence),
    role("efficiency-reliability", efficiency),
  ];
}

export function buildCandidateDiagnostics(input: DiagnosticInput): CandidateDiagnostics {
  return { failures: collectFailures(input), roles: buildRoles(input) };
}
