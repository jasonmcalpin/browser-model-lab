import { describe, expect, it } from "vitest";
import { characterMessages, contextUsage, DEFAULT_CHARACTER_SETTINGS, INITIAL_CHARACTER_SESSION,
  recordCharacterExchange, validateCharacterSettings } from "./memory";
import { estimateRoleTokens, requestEvidence, validateContextBudget } from "./trace";
import type { GenerationResult } from "../types";

const settings = { ...DEFAULT_CHARACTER_SETTINGS };
const populated = recordCharacterExchange(
  recordCharacterExchange(INITIAL_CHARACTER_SESSION, "The radio failed", "State the evidence."),
  "I was late", "Your absence is recorded.",
);
describe("character observability contracts", () => {
  it("supports distinctly observable memory strategies", () => {
    const roll = characterMessages({ ...populated, summary: "Unverified delay." }, "Continue", "", settings);
    const none = characterMessages(populated, "Continue", "", { ...settings, memoryStrategy: "none" });
    const full = characterMessages(populated, "Continue", "", { ...settings, memoryStrategy: "full" });
    const recent = characterMessages(populated, "Continue", "", { ...settings, memoryStrategy: "recent" });
    expect(roll.some(x => x.content.includes("Unverified delay."))).toBe(true);
    expect(none).toHaveLength(2);
    expect(full).toHaveLength(6);
    expect(recent).toHaveLength(6);
  });
  it("reports estimates as estimates and checks role/context guardrails", () => {
    const msgs = characterMessages(populated, "Continue");
    const usage = contextUsage(msgs, settings);
    expect(usage.countingMethod).toContain("estimate");
    expect(usage.limitIsModelValidated).toBe(false);
    expect(estimateRoleTokens(msgs)).toBeGreaterThan(0);
    expect(() => validateContextBudget(msgs, settings)).not.toThrow();
    expect(() => validateContextBudget(msgs, { ...settings, roleBudget: 64 })).toThrow("role allocation");
    expect(() => validateCharacterSettings({ ...settings, roleBudget: 8000, summaryBudget: 1024 })).toThrow("Reserved budgets");
  });
  it("preserves actual telemetry provenance and applied parameters", () => {
    const messages = characterMessages(populated, "Where was I?");
    const result: GenerationResult = {
      raw: "The record is incomplete.", final: "The record is incomplete.",
      metrics: { generatedTokens: 7, generationMs: 580, firstTokenMs: 140, tokensPerSecond: 12, termination: "EOS" },
      invocation: { messages, settings: { maxNewTokens: 512, temperature: 0.4 },
        adapterId: "declarative-v1", toolCallFormat: "tagged-json", compatibilityProfileId: "fixture" },
    };
    const evidence = requestEvidence({ id: "dialogue-1", kind: "dialogue", model: "fixture",
      startedAt: "2026-11-13T00:00:00Z", messages, settings, result,
      tokenizer: { tokens: 190, renderedPrompt: "EXACT TEMPLATE", method: "tokenizer" }, events: [] });
    expect(evidence.tokenizerPromptTokens).toBe(190);
    expect(evidence.renderedPrompt).toBe("EXACT TEMPLATE");
    expect(evidence.outputTokens).toBe(7);
    expect(evidence.firstTokenMs).toBe(140);
    expect(evidence.appliedGenerationSettings?.temperature).toBe(0.4);
    expect(evidence.promptEstimate.estimatedPromptTokens).toBeGreaterThan(0);
  });
});
