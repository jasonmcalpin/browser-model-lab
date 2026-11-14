import { describe, expect, it } from "vitest";
import { loadBrowserModelCards } from "./modelCards";
import { renderFormattedPrompt } from "./formattedPrompt";
import gemma from "../../testing/170-gemma4-e2b-roleplay-q4f16.json";
import violet from "../../testing/180-violet-1b4-chat-q8.json";

describe("WebGPU character model candidates", () => {
  it("accepts the published Gemma 4 roleplay pipeline recipe", () => {
    const card = loadBrowserModelCards({ gemma })[0]!;
    expect(card.candidate.modelId).toBe("skillsafe-ai/gemma-4-E2B-it-roleplay-ONNX");
    expect(card.candidate.dtype).toBe("q4f16");
    expect(card.candidate.compatibilityProfile.runtime.kind).toBe("pipeline");
    expect(card.candidate.compatibilityProfile.runtime.dtype).toBe("q4f16");
  });

  it("accepts Violet's q8 direct runtime and preserves its roleplay markers", () => {
    const card = loadBrowserModelCards({ violet })[0]!;
    expect(card.candidate.dtype).toBe("q8");
    expect(card.candidate.pipelineTask).toBe("direct-model");
    const format = card.candidate.compatibilityProfile.chat.messageFormat!;
    const prompt = renderFormattedPrompt([
      { role: "system", content: "A scene has begun." },
      { role: "user", content: "Good evening." },
      { role: "assistant", content: "Indeed." },
      { role: "user", content: "What is the hour?" },
    ], format);
    expect(prompt).toContain("Miss Violet Hartwell");
    expect(prompt).toContain("<|system|>\nA scene has begun.");
    expect(prompt).toContain("<|assistant|>\nIndeed.");
    expect(prompt).toContain("<|user|>\nWhat is the hour?");
    expect(prompt.endsWith("<|violet_mood|>\n")).toBe(true);
  });

  it("requires declarative format data and rejects executable card fields", () => {
    const unformatted = structuredClone(violet) as unknown as Record<string, any>;
    delete unformatted.candidate.compatibilityProfile.chat.messageFormat;
    expect(() => loadBrowserModelCards({ unformatted })).toThrow(/messageFormat/);
  });
});
