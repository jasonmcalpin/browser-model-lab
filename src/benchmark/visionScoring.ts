export type VisionScorer = "normalized-exact" | "contains-term" | "semantic-equivalent";
export const VISION_SCORING_VERSION = 1;
export interface VisionScoringPolicy {
  readonly scorers: readonly VisionScorer[];
  readonly acceptedTerms?: readonly string[];
  readonly semanticEquivalents?: readonly string[];
}
export interface VisionTrialScore {
  readonly passed: boolean;
  readonly scorer?: VisionScorer;
  readonly version: number;
  readonly reason: string;
}
export function normalizedVisionAnswer(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}
function containsPositiveTerm(response: string, term: string): boolean {
  const words = normalizedVisionAnswer(response).split(" ");
  const expected = normalizedVisionAnswer(term).split(" ");
  if (!expected[0]) return false;
  // Conservative rule: reject explicitly negative or contradictory answers instead of
  // awarding credit merely because the correct noun appears somewhere in the output.
  if (words.some(word => ["NO", "NOT", "WITHOUT", "NEVER", "ISNT", "ARENT", "NONE", "BUT", "HOWEVER", "INSTEAD"].includes(word)))
    return false;
  for (let i = 0; i <= words.length - expected.length; i++)
    if (expected.every((word,j) => words[i+j] === word)) return true;
  return false;
}
export function scoreVisionResponse(response: string, expected: string, policy: VisionScoringPolicy): VisionTrialScore {
  if (normalizedVisionAnswer(response) === normalizedVisionAnswer(expected))
    return { passed: true, scorer: "normalized-exact", version: VISION_SCORING_VERSION, reason: "normalized exact match" };
  if (policy.scorers.includes("contains-term") && (policy.acceptedTerms ?? [expected])
      .some(term => containsPositiveTerm(response, term)))
    return { passed: true, scorer: "contains-term", version: VISION_SCORING_VERSION, reason: "positive whole-term match" };
  if (policy.scorers.includes("semantic-equivalent") && (policy.semanticEquivalents ?? [])
      .some(phrase => normalizedVisionAnswer(phrase) === normalizedVisionAnswer(response)))
    return { passed: true, scorer: "semantic-equivalent", version: VISION_SCORING_VERSION, reason: "curated equivalent" };
  return { passed: false, version: VISION_SCORING_VERSION, reason: "no permitted scorer matched" };
}
