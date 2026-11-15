import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { transformersJsPlugin } from "arcanai/plugins/transformersjs";
import { buildModelInvocation, buildVisionInvocation } from "./modelAdapters";
import { createArcanAIModelExecutor } from "./arcanaiExecution";
import { parseBrowserModelCard } from "./modelCards";
import type { ModelRuntime } from "./modelRuntime";

const loadCandidate = (file: string) => parseBrowserModelCard(JSON.parse(readFileSync(
  new URL(`../../testing/${file}`, import.meta.url), "utf8"
)), file).candidate;
const candidate = loadCandidate("010-qwen3-0.6b-q4f16-control.json");
const visionCandidate = loadCandidate("070-qwen35-0.8b-multimodal.json");
const invocation = buildModelInvocation(candidate, {
  messages: [{ role: "user", content: "hello" }],
  maxNewTokens: 48,
  workload: "direct"
});

function mockRuntime(
  runtime: Pick<ModelRuntime, "generate"> & Partial<Pick<ModelRuntime, "generateVision">>,
  criteria = { reset() {}, interrupt() {} }
): ModelRuntime {
  let observer: { onText?(text: string): void; onToken?(): void } | undefined;
  const plugin = transformersJsPlugin({
    runtime,
    stoppingCriteria: criteria,
    createStreamer({ onText, onToken }) {
      return {
        onText(text: string) { onText(text); observer?.onText?.(text); },
        onToken() { onToken(); observer?.onToken?.(); }
      };
    }
  });
  return {
    plugin, stoppingCriteria: criteria,
    tokenizer: {}, templateSource: "test",
    renderPrompt: () => "prompt",
    generate: runtime.generate,
    ...(runtime.generateVision ? { generateVision: runtime.generateVision } : {}),
    observe(callbacks) { observer = callbacks; },
    async dispose() {}
  };
}

describe("ArcanAI BML owned runtime bridge", () => {
  it("routes model invocation without changing provider options or token events", async () => {
    const observed: Array<{ messages: unknown; options: Record<string, unknown> }> = [];
    const runtime = mockRuntime({
      async generate(messages, options) {
        observed.push({ messages, options });
        const streamer = options.streamer as { onText(text: string): void; onToken(): void };
        streamer.onToken(); streamer.onText("Hello");
        streamer.onToken(); streamer.onText("!");
      }
    });
    const callbacks: string[] = [];
    const executor = createArcanAIModelExecutor(candidate, runtime);
    const result = await executor.generate(invocation, new AbortController().signal, {
      onText(text) { callbacks.push(text); }
    });
    expect(result.raw).toBe("Hello!");
    expect(callbacks).toEqual(["Hello", "!"]);
    expect(result.metrics.generatedTokens).toBe(2);
    expect(observed[0]?.options.max_new_tokens).toBe(48);
    expect(observed[0]?.options.top_k).toBe(invocation.settings.topK);
    expect(observed[0]?.options.tokenizer_encode_kwargs).toEqual(invocation.tokenizerEncodeOptions);
    expect(observed[0]?.messages).toEqual(invocation.messages);
  });

  it("routes a typed image and text prompt through ArcanAI, not through BML decoding", async () => {
    let called: unknown;
    const runtime = mockRuntime({
      async generate() { throw new Error("text engine must not receive image"); },
      async generateVision(url, prompt, options) {
        called = { url, prompt, options };
        const streamer = options.streamer as { onText(text: string): void; onToken(): void };
        streamer.onToken(); streamer.onText("blue");
      }
    });
    const executor = createArcanAIModelExecutor(visionCandidate, runtime);
    const invocation = buildVisionInvocation(visionCandidate, "data:image/png;base64,AAAA", "What color?", 64);
    const result = await executor.generateVision(invocation, new AbortController().signal);
    expect(result.raw).toBe("blue");
    expect(result.metrics.generatedTokens).toBe(1);
    expect((called as { url: string }).url).toBe("data:image/png;base64,AAAA");
    expect((called as { prompt: string }).prompt).toBe("What color?");
  });

  it("does not retry a cancelled model call", async () => {
    const controller = new AbortController();
    let requests = 0, interrupts = 0;
    const runtime = mockRuntime({
      async generate() { requests++; controller.abort(); }
    }, { reset() {}, interrupt() { interrupts++; } });
    const executor = createArcanAIModelExecutor(candidate, runtime);
    await expect(executor.generate(invocation, controller.signal)).rejects.toThrow(/cancelled/);
    expect(requests).toBe(1);
    expect(interrupts).toBe(1);
  });
});
