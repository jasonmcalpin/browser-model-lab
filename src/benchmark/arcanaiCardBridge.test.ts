import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildModelInvocation } from "./modelAdapters";
import { arcanaiCardForInvocation } from "./arcanaiCardBridge";
import { parseBrowserModelCard } from "./modelCards";

const filenames = [
  "010-qwen3-0.6b.json",
  "020-lfm3-1.7b.json",
  "030-smollm2-1.7b.json",
  "040-qwen35-2b.json",
  "050-smollm3-3b.json",
  "060-qwen3-4b.json"
];

describe("ArcanAI six-model execution-card migration", () => {
  for (const name of filenames) {
    it(`preserves prepared direct invocation for ${name}`, () => {
      const raw = JSON.parse(readFileSync(
        new URL(`../../experiments/mara-dialogue/${name}`, import.meta.url), "utf8"
      ));
      const candidate = parseBrowserModelCard(raw, name).candidate;
      const invocation = buildModelInvocation(candidate, {
        messages: [{ role: "user", content: "Respond concisely." }],
        maxNewTokens: 256,
        workload: "direct"
      });
      const card = arcanaiCardForInvocation(candidate, invocation);
      expect(card.execution.model).toBe(candidate.modelId);
      expect(card.execution.runtime.kind).toBe(candidate.compatibilityProfile.runtime.kind);
      expect(card.execution.profile.id).toBe(candidate.compatibilityProfile.id);
      expect(card.execution.profile.chat).toEqual(candidate.compatibilityProfile.chat);
      expect("runtime" in card.execution.profile).toBe(false);
      expect(card.execution.plugin).toBe("@arcanai/plugin-transformersjs");
      expect(card.execution.options.maxTokens).toBe(invocation.settings.maxNewTokens);
      expect(card.execution.providerOptions.doSample).toBe(invocation.settings.doSample);
      expect(card.execution.providerOptions.tokenizerEncodeOptions)
        .toEqual(invocation.tokenizerEncodeOptions);
      expect(card.schemaVersion).toBe("1.0");
    });
  }
});
