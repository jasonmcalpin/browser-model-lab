import { describe, expect, it } from "vitest";
import type { VisionInvocation } from "./types";
import { buildVisionEvidenceRegistry, visionInvocationEvidence } from "./visionEvidence";

describe("vision evidence serialization", () => {
  it("persists invocation metadata without copying any image bytes", () => {
    const largeImage = "data:image/png;base64," + "A".repeat(4_000_000);
    const invocation: VisionInvocation = {
      imageUrl: largeImage,
      prompt: "How many people are visible?",
      settings: { maxNewTokens: 48 } as VisionInvocation["settings"],
      compatibilityProfileId: "vision-test",
    };
    const evidence = visionInvocationEvidence(invocation);
    expect(evidence).toEqual({
      prompt: invocation.prompt, settings: invocation.settings,
      compatibilityProfileId: invocation.compatibilityProfileId,
    });
    expect(JSON.stringify(evidence).length).toBeLessThan(500);
    expect(JSON.stringify(evidence)).not.toContain("data:image/");
    expect(invocation.imageUrl).toBe(largeImage);
  });

  it("deduplicates image paths shared by multiple fixtures and trials", () => {
    const { images, fixtures } = buildVisionEvidenceRegistry([
      { id: "people", image: "/artifacts/testing/vision-three-people.png", source: "fixtures/vision/people.json" },
      { id: "faces", image: "/artifacts/testing/vision-three-people.png" },
      { id: "red-hoodie", image: "/artifacts/testing/vision-three-people.png" },
      { id: "lamp", image: "/artifacts/testing/vision-empty-room.png" },
    ]);
    expect(images).toEqual([
      { id: "image-1", path: "/artifacts/testing/vision-three-people.png" },
      { id: "image-2", path: "/artifacts/testing/vision-empty-room.png" },
    ]);
    expect(fixtures.map(fixture => fixture.imageId)).toEqual(["image-1", "image-1", "image-1", "image-2"]);
    const data = JSON.stringify({ images, fixtures });
    expect(data.split("/artifacts/testing/vision-three-people.png")).toHaveLength(2);
  });

  it("rejects external URLs and nonfixture paths in evidence registries", () => {
    for (const image of ["data:image/png;base64,AA", "https://example.com/image.png", "../secret.png"])
      expect(() => buildVisionEvidenceRegistry([{ id: "bad", image }])).toThrow("repository fixture");
  });
});
