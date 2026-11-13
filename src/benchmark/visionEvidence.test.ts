import { describe, expect, it } from "vitest";
import type { VisionInvocation } from "./types";
import { visionInvocationEvidence } from "./visionEvidence";

describe("vision evidence serialization", () => {
  it("stores an image fixture path without retaining any bytes from a data URL", () => {
    const largeImage = "data:image/png;base64," + "A".repeat(4_000_000);
    const invocation: VisionInvocation = {
      imageUrl: largeImage,
      prompt: "How many people are visible?",
      settings: { maxNewTokens: 48 } as VisionInvocation["settings"],
      compatibilityProfileId: "vision-test",
    };
    const evidence = visionInvocationEvidence(invocation, "/artifacts/testing/vision-three-people.png");
    expect(evidence).toEqual({
      imageUrl: "/artifacts/testing/vision-three-people.png",
      prompt: invocation.prompt,
      settings: invocation.settings,
      compatibilityProfileId: invocation.compatibilityProfileId,
    });
    expect(JSON.stringify(evidence).length).toBeLessThan(500);
    expect(JSON.stringify(evidence)).not.toContain("data:image/");
    expect(JSON.stringify(invocation).length).toBeGreaterThan(4_000_000);
    expect(invocation.imageUrl).toBe(largeImage);
  });

  it("rejects inline and external URLs as persisted fixture references", () => {
    const invocation = {
      imageUrl: "data:image/png;base64,AA",
      prompt: "What is shown?",
      settings: { maxNewTokens: 48 } as VisionInvocation["settings"],
      compatibilityProfileId: "vision-test",
    };
    for (const source of ["data:image/png;base64,AA", "https://example.com/image.png", "../secret.png"])
      expect(() => visionInvocationEvidence(invocation, source)).toThrow("repository fixture");
  });
});
