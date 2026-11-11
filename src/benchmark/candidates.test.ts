import { describe, expect, it } from "vitest";
import { BROWSER_AI_BENCHMARK_CANDIDATES, DEFAULT_BROWSER_AI_CANDIDATE_ID, validateCandidateRegistry } from "./candidates";
import { BROWSER_MODEL_CARDS, loadBrowserModelCards } from "./modelCards";

describe("browser AI benchmark model-card inventory", () => {
  it("discovers active candidates exclusively from testing/*.json", () => {
    expect(BROWSER_MODEL_CARDS.length).toBeGreaterThan(0);
    expect(BROWSER_AI_BENCHMARK_CANDIDATES).toHaveLength(BROWSER_MODEL_CARDS.length);
    expect(BROWSER_AI_BENCHMARK_CANDIDATES.map((candidate) => candidate.id)).toContain(DEFAULT_BROWSER_AI_CANDIDATE_ID);
    expect(BROWSER_AI_BENCHMARK_CANDIDATES.every((candidate) => Boolean(candidate.compatibilityProfileId))).toBe(true);
  });

  it("sorts cards deterministically and rejects duplicate candidate ids", () => {
    const candidate = BROWSER_AI_BENCHMARK_CANDIDATES[0]!;
    const cards = loadBrowserModelCards({
      "b.json": { schemaVersion: 2, runOrder: 20, candidate: { ...candidate, id: "second" } },
      "a.json": { schemaVersion: 2, runOrder: 10, default: true, candidate: { ...candidate, id: "first" } },
    });
    expect(cards.map((card) => card.candidate.id)).toEqual(["first", "second"]);
    expect(() => loadBrowserModelCards({
      "a.json": { schemaVersion: 2, candidate },
      "b.json": { schemaVersion: 2, candidate },
    })).toThrow(/Duplicate/);
  });

  it("rejects executable-looking content and executable fields", () => {
    const candidate = BROWSER_AI_BENCHMARK_CANDIDATES[0]!;
    expect(() => loadBrowserModelCards({ "bad.json": { schemaVersion: 2, notes: ["() => alert(1)"], candidate } }))
      .toThrow(/executable-looking/);
    expect(() => loadBrowserModelCards({ "bad.json": { schemaVersion: 2, script: "alert(1)", candidate } }))
      .toThrow(/forbidden|unsupported/);
  });

  it("rejects duplicate runtime descriptors without changing benchmark cases", () => {
    expect(() => validateCandidateRegistry([
      BROWSER_AI_BENCHMARK_CANDIDATES[0]!,
      BROWSER_AI_BENCHMARK_CANDIDATES[0]!,
    ])).toThrow(/Duplicate/);
  });
});
