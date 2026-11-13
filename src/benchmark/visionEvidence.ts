import type { VisionInvocation } from "./types";

export interface VisionImageEvidence {
  readonly id: string;
  readonly path: string;
  readonly mimeType: string;
  readonly width: number;
  readonly height: number;
  readonly rasterization: "canvas-png-1600x900-v1";
}
export interface VisionFixtureReference {
  readonly id: string;
  readonly imageId: string;
  readonly source?: string;
}
export type VisionInvocationEvidence = Pick<VisionInvocation, "settings" | "compatibilityProfileId">;

/** Persist each image source once, even if several questions and trials share it. */
export function buildVisionEvidenceRegistry(fixtures: readonly {
  id: string; image: string; source?: string;
}[]): { images: VisionImageEvidence[]; fixtures: VisionFixtureReference[] } {
  const idByPath = new Map<string, string>();
  const images: VisionImageEvidence[] = [];
  const references = fixtures.map(fixture => {
    if (!/^\/artifacts\/[a-zA-Z0-9/_-]+\.(png|jpg|jpeg|webp|svg)$/.test(fixture.image))
      throw new Error("Vision evidence must reference a repository fixture image.");
    let imageId = idByPath.get(fixture.image);
    if (!imageId) {
      imageId = `image-${images.length + 1}`;
      idByPath.set(fixture.image, imageId);
      const extension = fixture.image.split(".").pop()?.toLowerCase();
      const mimeType = extension === "svg" ? "image/svg+xml"
        : extension === "jpg" ? "image/jpeg" : `image/${extension}`;
      images.push({ id: imageId, path: fixture.image, mimeType,
        width: 1600, height: 900, rasterization: "canvas-png-1600x900-v1" });
    }
    return { id: fixture.id, imageId, ...(fixture.source ? { source: fixture.source } : {}) };
  });
  return { images, fixtures: references };
}

/** Explicit field projection: no runtime data URL or prompt replicated per trial. */
export function visionInvocationEvidence(invocation: VisionInvocation): VisionInvocationEvidence {
  return { settings: invocation.settings, compatibilityProfileId: invocation.compatibilityProfileId };
}

export function assertCompactVisionEvidence(value: unknown): void {
  const visit = (current: unknown, path: string): void => {
    if (typeof current === "string") {
      if (/^(?:data:|blob:)/i.test(current)) throw new Error(`Inline payload forbidden in vision evidence at ${path}`);
      return;
    }
    if (current === null || typeof current !== "object") return;
    if (current instanceof ArrayBuffer || ArrayBuffer.isView(current))
      throw new Error(`Binary value forbidden in vision evidence at ${path}`);
    for (const [key, child] of Object.entries(current))
      visit(child, `${path}.${key}`);
  };
  visit(value, "visionCapability");
}
