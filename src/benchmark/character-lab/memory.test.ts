import { describe, expect, it } from "vitest";
import { acceptCompression, characterMessages, compressionRequest, DEFAULT_CHARACTER_SETTINGS,
  dueForCompression, INITIAL_CHARACTER_SESSION, recordCharacterExchange, validateCharacterSettings } from "./memory";

const settings = { ...DEFAULT_CHARACTER_SETTINGS, recentPairs: 2, compressAfterPairs: 4 };
function exchanges(count: number) {
  let state = INITIAL_CHARACTER_SESSION;
  for (let i = 0; i < count; i += 1) state = recordCharacterExchange(state, `player ${i}`, `mara ${i}`);
  return state;
}
describe("character lab memory", () => {
  it("separates permanent instructions, summary, recent exchanges and latest input", () => {
    const state = acceptCompression(exchanges(4), "Player claims outside links failed; unverified.", 4);
    const messages = characterMessages(state, "What did I say?", "Be skeptical.");
    expect(messages[0]?.role).toBe("system");
    expect(messages[0]?.content).toContain("Mara Venn");
    expect(messages[0]?.content).toContain("Be skeptical.");
    expect(messages[1]?.content).toContain("fallible");
    expect(messages[1]?.content).toContain("unverified");
    expect(messages.map((x) => x.role)).toEqual(["system", "user", "user", "assistant", "user", "assistant", "user"]);
    expect(messages.at(-1)?.content).toBe("What did I say?");
  });
  it("compresses only older complete exchange pairs and keeps full audit transcript", () => {
    const state = exchanges(4);
    expect(dueForCompression(exchanges(3), settings)).toBe(false);
    expect(dueForCompression(state, settings)).toBe(true);
    const request = compressionRequest(state, settings);
    expect(request.compressedTurnCount).toBe(4);
    expect(request.messages[1]?.content).toContain("player 0");
    expect(request.messages[1]?.content).not.toContain("player 2");
    const updated = acceptCompression(state, "An unresolved absence claim.", 4);
    expect(updated.transcript).toHaveLength(8);
    expect(updated.recent).toHaveLength(4);
    expect(updated.compressionCount).toBe(1);
    expect(dueForCompression(updated, settings)).toBe(false);
    expect(dueForCompression(recordCharacterExchange(updated, "later", "answer"), settings)).toBe(false);
  });
  it("supports deliberate zero short-term exchanges without dropping complete export", () => {
    const custom = { ...settings, recentPairs: 0, compressAfterPairs: 1 };
    expect(dueForCompression(exchanges(1), custom)).toBe(true);
    const task = compressionRequest(exchanges(1), custom);
    expect(task.compressedTurnCount).toBe(2);
    expect(acceptCompression(exchanges(1), "Unverified statement.", 2).recent).toHaveLength(0);
  });
  it("rejects malformed settings, summaries and partial compression boundaries", () => {
    expect(() => validateCharacterSettings({ ...settings, maxNewTokens: 1 })).toThrow();
    expect(() => validateCharacterSettings({ ...settings, temperature: 3 })).toThrow();
    expect(() => acceptCompression(exchanges(2), "", 2)).toThrow();
    expect(() => acceptCompression(exchanges(2), "Valid", 1)).toThrow();
  });
});
