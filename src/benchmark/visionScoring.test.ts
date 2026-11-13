import { describe, expect, it } from "vitest";
import { scoreVisionResponse } from "./visionScoring";
describe("vision scoring precedence", () => {
  const policy = { scorers: ["normalized-exact", "contains-term", "semantic-equivalent"] as const,
    acceptedTerms: ["plant"], semanticEquivalents: ["houseplant"] };
  it("prioritizes exact over all other scorers", () =>
    expect(scoreVisionResponse("plant", "PLANT", policy).scorer).toBe("normalized-exact"));
  it("accepts a positive whole-word term but not negation or substring", () => {
    expect(scoreVisionResponse("A potted plant", "PLANT", policy).scorer).toBe("contains-term");
    expect(scoreVisionResponse("There is no plant", "PLANT", policy).passed).toBe(false);
    expect(scoreVisionResponse("plantation", "PLANT", policy).passed).toBe(false);
  });
  it("uses curated equivalent only when explicitly enabled", () => {
    expect(scoreVisionResponse("houseplant", "PLANT", policy).scorer).toBe("semantic-equivalent");
    expect(scoreVisionResponse("houseplant", "PLANT", { scorers: ["normalized-exact"] }).passed).toBe(false);
  });
  it("does not loosen exact-only OCR", () =>
    expect(scoreVisionResponse("NO SINGLE ORACLE ONS THE RESULT", "NO SINGLE ORACLE OWNS THE RESULT",
      { scorers: ["normalized-exact"] }).passed).toBe(false));
});
