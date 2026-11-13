import defaultText from "../../fixtures/vision/table-text.json";
import defaultReasoning from "../../fixtures/vision/table-reasoning.json";

export interface VisionFixture {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly image: string;
  readonly prompt: string;
  readonly expected: string;
  readonly scorer: "normalized-exact";
  readonly trials: number;
  readonly maxNewTokens: number;
  readonly source?: string;
}
export const DEFAULT_VISION_CASES: readonly VisionFixture[] = parseVisionFixtures([
  defaultText, defaultReasoning,
]);

export function parseVisionFixtures(value: unknown): readonly VisionFixture[] {
  if (!Array.isArray(value) || !value.length || value.length > 40)
    throw new Error("Vision fixtures must be a nonempty array of at most 40 cases.");
  const ids = new Set<string>();
  return value.map((entry: unknown) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry))
      throw new Error("Invalid vision fixture.");
    const v = entry as Record<string, unknown>;
    if (Object.keys(v).some(k => !["schemaVersion", "id", "image", "prompt", "expected", "scorer", "trials", "maxNewTokens", "source"].includes(k))
      || v.schemaVersion !== 1 || typeof v.id !== "string"
      || !/^[a-z0-9][a-z0-9._-]{0,79}$/.test(v.id)
      || typeof v.image !== "string"
      || !/^\/artifacts\/[a-zA-Z0-9/_-]+\.(?:png|jpg|jpeg|webp|svg)$/.test(v.image)
      || typeof v.prompt !== "string" || !v.prompt.trim() || v.prompt.length > 2000
      || typeof v.expected !== "string" || !v.expected.trim() || v.expected.length > 1000
      || v.scorer !== "normalized-exact"
      || !Number.isInteger(v.trials) || Number(v.trials) < 1 || Number(v.trials) > 10
      || !Number.isInteger(v.maxNewTokens) || Number(v.maxNewTokens) < 16 || Number(v.maxNewTokens) > 768)
      throw new Error("Invalid vision fixture definition.");
    if (ids.has(v.id)) throw new Error("Duplicate vision fixture ID: " + v.id);
    ids.add(v.id);
    return v as unknown as VisionFixture;
  });
}
