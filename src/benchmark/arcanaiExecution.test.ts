import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { TextStreamer } from "@huggingface/transformers";
import { buildModelInvocation } from "./modelAdapters";
import { createArcanAIModelExecutor } from "./arcanaiExecution";
import { parseBrowserModelCard } from "./modelCards";
import type { ModelRuntime } from "./modelRuntime";

const spec = JSON.parse(readFileSync(
  new URL("../../experiments/mara-dialogue/010-qwen3-0.6b.json", import.meta.url), "utf8"
));
const candidate = parseBrowserModelCard(spec, "arcanai fake-runtime test").candidate;
const invocation = buildModelInvocation(candidate, {
  messages: [{ role: "user", content: "hello" }],
  maxNewTokens: 48,
  workload: "direct"
});

describe("ArcanAI BML shared runtime adapter", () => {
  it("routes a prepared model invocation without changing its provider settings", async () => {
    const observed: Record<string, unknown>[] = [];
    const runtime: ModelRuntime = {
      tokenizer: {},
      templateSource: "test",
      renderPrompt: () => "hello",
      async generate(messages, options) {
        observed.push({ messages, options });
        const streamer = options.streamer as { onText(text: string): void; onToken(): void };
        streamer.onToken();
        streamer.onText("Hello");
        streamer.onToken();
        streamer.onText("!");
      },
      async dispose() {}
    };
    const callbacks: string[] = [];
    const executor = createArcanAIModelExecutor(
      candidate, runtime,
      args => args as unknown as TextStreamer,
      { reset() {}, interrupt() {} }
    );
    const result = await executor.generate(invocation, new AbortController().signal, {
      onText(text) { callbacks.push(text); }
    });
    expect(result.raw).toBe("Hello!");
    expect(callbacks).toEqual(["Hello", "!"]);
    expect(result.metrics.generatedTokens).toBe(2);
    expect((observed[0]?.options as Record<string, unknown>).max_new_tokens).toBe(48);
    expect((observed[0]?.options as Record<string, unknown>).top_k)
      .toBe(invocation.settings.topK);
    expect((observed[0]?.options as Record<string, unknown>).tokenizer_encode_kwargs)
      .toEqual(invocation.tokenizerEncodeOptions);
    expect(observed[0]?.messages).toEqual(invocation.messages);
  });

  it("reports a cancelled generation without silently retrying", async () => {
    const signal = new AbortController();
    let requests = 0;
    let interrupts = 0;
    const runtime: ModelRuntime = {
      tokenizer: {}, templateSource: "test", renderPrompt: () => "hello",
      async generate() { requests++; signal.abort(); },
      async dispose() {}
    };
    const executor = createArcanAIModelExecutor(
      candidate, runtime, () => ({} as TextStreamer),
      { reset() {}, interrupt() { interrupts++; } }
    );
    await expect(executor.generate(invocation, signal.signal))
      .rejects.toThrow(/cancelled/);
    expect(requests).toBe(1);
    expect(interrupts).toBe(1);
  });
});
