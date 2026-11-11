import { describe, expect, it } from "vitest";
import { BROWSER_AI_BENCHMARK_CANDIDATES } from "./candidates";
import { adapterReport, buildModelInvocation, buildVisionInvocation, parseAdapterOutput } from "./modelAdapters";
import { toolDefinitions } from "./toolHarness";

const byId = (id: string) => BROWSER_AI_BENCHMARK_CANDIDATES.find((entry) => entry.id === id)!;
const toolRequest = {
  messages: [
    { role: "system" as const, content: "Never invent results." },
    { role: "user" as const, content: "Inspect R-17." },
  ],
  maxNewTokens: 512, workload: "tool" as const, tools: toolDefinitions(["inspect_relay"]),
};

describe("browser AI compatibility adapters", () => {
  it("uses Qwen3 native tools and upstream non-thinking sampling for every benchmark workload", () => {
    const model = byId("qwen3-0.6b-q4f16-control");
    const invocation = buildModelInvocation(model, toolRequest);
    expect(invocation.messages[0]).toMatchObject({ role: "system" });
    expect(invocation.tokenizerEncodeOptions).toMatchObject({ enable_thinking: false, tools: expect.any(Array) });
    expect(invocation.settings).toEqual({
      maxNewTokens: 512, doSample: true, temperature: 0.7, topP: 0.8, topK: 20, minP: 0,
    });
    const production = buildModelInvocation(model, {
      messages: [{ role: "user", content: "Bounded response." }], maxNewTokens: 96, workload: "production",
    });
    expect(production.settings).toEqual({
      maxNewTokens: 96, doSample: true, temperature: 0.7, topP: 0.8, topK: 20, minP: 0,
    });
    expect(adapterReport(model)).toMatchObject({
      runtimeKind: "pipeline", toolSupportMode: "native-template",
      compatibilityProfileId: "qwen3-nonthinking-native-v1",
    });
  });

  it("preserves canonical assistant/tool history for native tool templates", () => {
    for (const id of ["qwen3-0.6b-q4f16-control", "granite4-1b-q4f16", "bonsai-1.7b-q4"]) {
      const model = byId(id);
      const invocation = buildModelInvocation(model, {
        ...toolRequest,
        messages: [
          ...toolRequest.messages,
          { role: "assistant", content: '<tool_call>{"name":"inspect_relay","arguments":{"id":"R-17"}}</tool_call>' },
          { role: "tool", name: "inspect_relay", content: '{"tool":"inspect_relay","ok":true}' },
        ],
      });
      expect(invocation.messages.at(-1)).toMatchObject({ role: "tool", name: "inspect_relay" });
      expect(invocation.tokenizerEncodeOptions).toMatchObject({ tools: expect.any(Array) });
    }
  });

  it("folds DeepSeek system and tool-result semantics into user content and keeps its reasoning profile", () => {
    const model = byId("deepseek-r1-distill-qwen-1.5b-q4f16");
    const invocation = buildModelInvocation(model, {
      ...toolRequest,
      messages: [
        ...toolRequest.messages,
        { role: "assistant", content: '{"type":"tool_call","call":{"tool":"inspect_relay","args":{"id":"R-17"}}}' },
        { role: "tool", name: "inspect_relay", content: '{"tool":"inspect_relay","ok":true}' },
      ],
    });
    expect(invocation.messages).toHaveLength(1);
    expect(invocation.messages[0]).toMatchObject({ role: "user" });
    expect(invocation.messages[0]?.content).toContain("DETERMINISTIC TOOL RECEIPT");
    expect(invocation.messages[0]?.content).toContain("Begin the response with <think>");
    expect(invocation.settings).toEqual({ maxNewTokens: 512, doSample: true, temperature: 0.6, topP: 0.95 });
    expect(adapterReport(model)).toMatchObject({
      reasoningFormat: "think-tags", toolSupportMode: "prompted-protocol",
    });
  });

  it("renders SmolLM2 documented function protocol and normalizes tagged response", () => {
    const model = byId("smollm2-1.7b-instruct-q4f16");
    const invocation = buildModelInvocation(model, toolRequest);
    expect(invocation.messages[0]?.content).toContain("<tools>");
    expect(invocation.messages[0]?.content).toContain("<tool_call>");
    expect(parseAdapterOutput(model, '<tool_call>[{"name":"inspect_relay","arguments":{"id":"R-17"}}]</tool_call>').turn)
      .toEqual({ type: "tool_call", call: { tool: "inspect_relay", args: { id: "R-17" } } });
  });

  it("normalizes LFM3 native XML tool calls", () => {
    const model = byId("lfm3-1.7b-q4f16");
    const output = parseAdapterOutput(model,
      "<think></think><tool_call><function=inspect_relay><parameter=id>R-17</parameter></function></tool_call>");
    expect(output.turn).toEqual({ type: "tool_call", call: { tool: "inspect_relay", args: { id: "R-17" } } });
    const invocation = buildModelInvocation(model, toolRequest);
    expect(invocation.settings).toEqual({
      maxNewTokens: 512, doSample: true, temperature: 0.1, topK: 50, repetitionPenalty: 1.1,
    });
    expect(invocation.tokenizerEncodeOptions).toMatchObject({ enable_thinking: false, tools: expect.any(Array) });
  });

  it("uses the documented Qwen3.5 non-thinking text profile for both text-only and direct runtimes", () => {
    const model = byId("qwen35-0.8b-q4f16");
    const invocation = buildModelInvocation(model, {
      messages: [{ role: "user", content: "Return READY." }], maxNewTokens: 96, workload: "production",
    });
    expect(invocation.compatibilityProfileId).toBe("qwen35-text-pipeline-nonthinking-v1");
    expect(invocation.settings).toEqual({
      maxNewTokens: 96, doSample: true, temperature: 1, topP: 1, topK: 20, minP: 0,
      presencePenalty: 2, repetitionPenalty: 1,
    });
    expect(adapterReport(model)).toMatchObject({ runtimeKind: "pipeline", toolSupportMode: "unknown" });
    expect(adapterReport(byId("qwen35-2b-q4f16"))).toMatchObject({
      runtimeKind: "direct-model", compatibilityProfileId: "qwen35-text-nonthinking-v1",
    });
  });

  it("uses a separate VL profile for the Qwen3.5 multimodal candidate", () => {
    const model = byId("qwen35-0.8b-multimodal");
    expect(adapterReport(model)).toMatchObject({
      runtimeKind: "direct-model",
      compatibilityProfileId: "qwen35-multimodal-nonthinking-v1",
      visionProfile: { doSample: true, temperature: 0.7, topP: 0.8, topK: 20,
        minP: 0, presencePenalty: 1.5, repetitionPenalty: 1 },
    });
    expect(buildVisionInvocation(model, "data:image/png;base64,fixture", "Read the chart.", 96)).toMatchObject({
      compatibilityProfileId: "qwen35-multimodal-nonthinking-v1",
      settings: { maxNewTokens: 96, doSample: true, temperature: 0.7, topP: 0.8, topK: 20,
        minP: 0, presencePenalty: 1.5, repetitionPenalty: 1 },
    });
  });

  it("separates reasoning text before normalizing final structured output", () => {
    const output = parseAdapterOutput(byId("deepseek-r1-distill-qwen-1.5b-q4f16"),
      '<think>reason carefully</think>\n{"type":"tool_call","call":{"tool":"wikipedia_search","args":{"q":"Kant"}}}');
    expect(output.reasoningTokens).toBe(2);
    expect(output.turn).toEqual({ type: "tool_call", call: { tool: "wikipedia_search", args: { q: "Kant" } } });
  });
});
