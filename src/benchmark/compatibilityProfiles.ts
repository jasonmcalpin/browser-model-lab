import type { BrowserModelCandidate, GenerationProfileSpec, GenerationSettings,
  ModelCompatibilityProfile } from "./types";

export function resolveGenerationProfile(spec: GenerationProfileSpec): Omit<GenerationSettings, "maxNewTokens"> {
  const resolved: Record<string, boolean | number> = {};
  for (const [key, value] of Object.entries(spec)) {
    if (value === undefined || value === "auto") continue;
    resolved[key] = value;
  }
  return resolved as Omit<GenerationSettings, "maxNewTokens">;
}

export function compatibilityProfileFor(candidate: BrowserModelCandidate): ModelCompatibilityProfile {
  const profile = candidate.compatibilityProfile;
  if (!profile) throw new Error(`Candidate has no embedded compatibility profile: ${candidate.id}`);
  if (profile.id !== candidate.compatibilityProfileId)
    throw new Error(`Embedded compatibility profile id mismatch: ${candidate.id}`);
  if (profile.adapterId !== candidate.adapterId)
    throw new Error(`Embedded compatibility profile adapter mismatch: ${candidate.id}`);
  if (profile.family !== candidate.family)
    throw new Error(`Embedded compatibility profile family mismatch: ${candidate.id}`);
  return profile;
}
