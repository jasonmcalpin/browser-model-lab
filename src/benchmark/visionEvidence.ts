import type { VisionInvocation } from "./types";

export type VisionInvocationEvidence = Omit<VisionInvocation, "imageUrl">;
export interface VisionFixtureIdentity {
  readonly id: string;
  readonly image: string;
  readonly source?: string;
}
export interface VisionImageReference {
  readonly id: string;
  readonly path: string;
}
export interface VisionCaseReference {
  readonly id: string;
  readonly imageId: string;
  readonly source?: string;
}

/**
 * Persist each distinct image path once, and reference its ID from each test case.
 * Image bytes exist only in runtime requests, never benchmark artifacts.
 */
export function buildVisionEvidenceRegistry(fixtures: readonly VisionFixtureIdentity[]): {
  images: VisionImageReference[];
  fixtures: VisionCaseReference[];
} {
  const seen = new Map<string, string>();
  const images: VisionImageReference[] = [];
  const references = fixtures.map(({ id, image, source }): VisionCaseReference => {
    if (!/^\/artifacts\/[a-zA-Z0-9/_-]+\.(?:png|jpg|jpeg|webp|svg)$/.test(image))
      throw new Error("Vision evidence requires a repository fixture image path.");
    let imageId = seen.get(image);
    if (!imageId) {
      imageId = `image-${images.length + 1}`;
      seen.set(image, imageId);
      images.push({ id: imageId, path: image });
    }
    return { id, imageId, ...(source ? { source } : {}) };
  });
  return { images, fixtures: references };
}

/** Exclude all image bytes from persisted model invocations. */
export function visionInvocationEvidence(invocation: VisionInvocation): VisionInvocationEvidence {
  return {
    prompt: invocation.prompt,
    settings: invocation.settings,
    compatibilityProfileId: invocation.compatibilityProfileId,
  };
}
