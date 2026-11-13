import { describe, expect, it } from "vitest";
import { assertCompactVisionEvidence, buildVisionEvidenceRegistry, visionInvocationEvidence } from "./visionEvidence";
import type { VisionInvocation } from "./types";

describe("vision artifact schema 14", () => {
  const image = "/artifacts/testing/vision-three-people.png";
  it("deduplicates image sources across cases", () => {
    const registry = buildVisionEvidenceRegistry([
      { id: "people", image, source: "fixtures/vision/people.json" },
      { id: "faces", image },
      { id: "color", image },
      { id: "other", image: "/artifacts/testing/vision-empty-room.png" },
    ]);
    expect(registry.images).toHaveLength(2);
    expect(registry.fixtures.map(fixture => fixture.imageId)).toEqual(["image-1", "image-1", "image-1", "image-2"]);
    expect(JSON.stringify(registry).split(image)).toHaveLength(2);
  });

  it("never persists full image bytes, even when a model invocation contains them", () => {
    const payload = "data:image/png;base64," + "A".repeat(4_000_000);
    const request: VisionInvocation = {
      imageUrl: payload, prompt: "Count people",
      settings: { maxNewTokens: 48 } as VisionInvocation["settings"],
      compatibilityProfileId: "test",
    };
    const evidence = visionInvocationEvidence(request);
    expect(evidence).toEqual({ settings: request.settings, compatibilityProfileId: "test" });
    expect(JSON.stringify(evidence).length).toBeLessThan(500);
    expect(request.imageUrl).toEqual(payload);
    expect(() => assertCompactVisionEvidence({ cases: [{ invocations: [request] }] }))
      .toThrow(/Inline payload forbidden/);
    expect(() => assertCompactVisionEvidence({ cases: [{ invocations: [evidence] }] })).not.toThrow();
    expect(() => assertCompactVisionEvidence({ raw: new Uint8Array(12) })).toThrow(/Binary value forbidden/);
  });

  it("rejects unsafe image references", () => {
    for (const path of ["data:image/png;base64,AAAA", "https://example.com/photo.png", "../image.png"])
      expect(() => buildVisionEvidenceRegistry([{ id: "invalid", image: path }])).toThrow(/repository fixture/);
  });
});
