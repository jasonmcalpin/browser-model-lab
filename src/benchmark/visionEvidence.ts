import type { VisionInvocation } from "./types";

/**
 * The runtime needs the full image data URL while executing, but benchmark artifacts
 * must reference their immutable repository fixture instead of embedding image bytes.
 */
export function visionInvocationEvidence(invocation: VisionInvocation, fixturePath: string): VisionInvocation {
  if (!/^\/artifacts\/[a-zA-Z0-9/_-]+\.(?:png|jpg|jpeg|webp|svg)$/.test(fixturePath))
    throw new Error("Vision evidence requires a repository fixture image path.");
  return {
    imageUrl: fixturePath,
    prompt: invocation.prompt,
    settings: invocation.settings,
    compatibilityProfileId: invocation.compatibilityProfileId,
  };
}
