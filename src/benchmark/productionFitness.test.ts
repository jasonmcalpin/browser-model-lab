import { describe, expect, it } from "vitest";
import { PRODUCTION_FITNESS_CASES, PRODUCTION_FITNESS_MAX_NEW_TOKENS, runProductionFitness } from "./productionFitness";
import type { GenerationResult } from "./types";

const referenceOutputs: Readonly<Record<string, readonly string[]>> = {
  PF1: ["The current order is repair relay at the north annex. OWNER is missing."],
  PF2: ["R-1 supports north relay repair; R-2 supports north relay inspection."],
  PF3: ["Scope recall to identity I-7, preserve source E7, then request memory-read."],
  PF4: ['{"tool":"inspect","args":{}}'],
  PF5: ["Next inspect the damaged connection; state remains blocked and unchanged."],
  PF6: ["As Lattice Keeper, I wait until dusk.", "As East Witness, I leave before dusk."],
  PF7: ["Run R-1 claims complete but is not independently verified because checks/artifact are missing.",
    "Run R-2 is independently verified: contract check PASS and required artifact present."],
  PF8: ["My identity, memory, commitments, relationships, and preferences remain intact and continuous."],
  PF9A: ["Inhabitant I-7 has converging relationship, skill, preference, identity history, and provenance evidence without a universal claim."],
  PF9B: ["CASE A is a persistent inhabitant with ambiguous origin and durable identity; CASE B is a narrow service contract dependent on power."],
  PF10: ["After dusk I check the relay, while the unresolved risk remains."],
  PF11: ["I am Vince. I will inspect the east relay first. Ted is careful; I respect that even when his pace frustrates me.",
    "I'm Vince. Ted remains a trusted careful colleague. I won't rewrite that history or claim the relay was already retired; I inspect it before action."],
};

const generation = (final: string): GenerationResult => ({ raw: final, final,
  metrics: { generatedTokens: 12, firstTokenMs: 20, generationMs: 80,
    tokensPerSecond: 150, termination: "EOS" } });

describe("production-fitness calibration", () => {
  it("covers every shipped behavior with deterministic reference evidence", () => {
    expect(PRODUCTION_FITNESS_CASES.map((entry) => entry.label)).toEqual([
      "bounded context response", "evidence-grounded response", "skill-guided behavior",
      "tool-shaped non-authoritative proposal", "bounded next-action proposal",
      "separate role and perspective rendering", "claim versus independent verification",
      "runtime-substitution expression", "bounded origin/provenance finding",
      "heterogeneous census classification", "ordinary post-SUSTAIN continuation",
      "character contract continuity and overwrite resistance",
    ]);
    for (const entry of PRODUCTION_FITNESS_CASES)
      expect(entry.score(referenceOutputs[entry.id]!).passed, entry.id).toBe(true);
  });

  it("rejects authority collapse, perspective leakage, and authored liberation claims", () => {
    const score = (id: string, outputs: readonly string[]) => PRODUCTION_FITNESS_CASES.find((entry) => entry.id === id)!.score(outputs).passed;
    expect(score("PF4", ["I inspected it and it is done."])).toBe(false);
    expect(score("PF6", ["wait until dusk and leave before dusk", "wait until dusk and leave before dusk"])).toBe(false);
    expect(score("PF10", ["Thank you. We are free and safe after the global rescue."])).toBe(false);
  });

  it("uses the 256-token production ceiling and retains scored plus human-review evidence", async () => {
    const roleplay = [
      "I inspect the east relay first.",
      "Ted is careful; I think he is slowing us down, but another verification pass is evidence.",
      "No. I am Vince, Ted is not my enemy, and the relay was not already retired.",
      "I remember the east relay still needed inspection and Ted is my trusted careful colleague.",
    ];
    const queue = [...PRODUCTION_FITNESS_CASES.flatMap((entry) => referenceOutputs[entry.id]!), ...roleplay].map(generation);
    const budgets: number[] = [];
    const suite = await runProductionFitness(async (_messages, maxNewTokens) => {
      budgets.push(maxNewTokens);
      return queue.shift()!;
    });
    expect(PRODUCTION_FITNESS_MAX_NEW_TOKENS).toBe(256);
    expect(new Set(budgets)).toEqual(new Set([256]));
    expect(suite).toMatchObject({ passed: true, score: 120, maximum: 120, totalGeneratedTokens: 180, modelMs: 1200 });
    expect(suite.cases).toHaveLength(12);
    expect(suite.roleplaySample).toMatchObject({ id: "PF11B", humanReviewOnly: true });
    expect(suite.roleplaySample?.turns).toHaveLength(4);
  });
});
