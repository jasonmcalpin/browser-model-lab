import { compatibilityProfileFor, resolveGenerationProfile } from "./compatibilityProfiles";
import { adapterReport, buildModelInvocation, parseAdapterOutput } from "./modelAdapters";
import { toolDefinitions } from "./toolHarness";
import type { AdapterConformanceResult, BrowserModelCandidate, ModelTurn } from "./types";

function sameTurn(actual: ModelTurn | undefined, expected: ModelTurn): boolean {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function fixtureFor(candidate: BrowserModelCandidate): string {
  const profile = compatibilityProfileFor(candidate);
  if (profile.tools.callFormat === "smollm2-native")
    return '<tool_call>[{"name":"inspect_relay","arguments":{"id":"R-17"}}]</tool_call>';
  if (profile.tools.callFormat === "lfm3-xml")
    return '<tool_call><function=inspect_relay><parameter=id>R-17</parameter></function></tool_call>';
  if (profile.tools.callFormat === "qwen-native")
    return '<tool_call>{"name":"inspect_relay","arguments":{"id":"R-17"}}</tool_call>';
  return '{"type":"tool_call","call":{"tool":"inspect_relay","args":{"id":"R-17"}}}';
}

export function checkAdapterConformance(candidate: BrowserModelCandidate): AdapterConformanceResult {
  const profile = compatibilityProfileFor(candidate);
  const report = adapterReport(candidate);
  const expectedTurn: ModelTurn = { type: "tool_call", call: { tool: "inspect_relay", args: { id: "R-17" } } };
  const encoded = fixtureFor(candidate);
  const invocation = buildModelInvocation(candidate, {
    messages: [
      { role: "system", content: "system" },
      { role: "user", content: "inspect R-17" },
      { role: "assistant", content: encoded },
      { role: "tool", name: "inspect_relay", content: JSON.stringify({ tool: "inspect_relay", ok: true,
        result: { id: "R-17", health: "healthy" } }) },
    ],
    maxNewTokens: 512,
    workload: "tool",
    tools: toolDefinitions(["inspect_relay"]),
  });
  const hasNativeToolMessage = invocation.messages.some((message) => message.role === "tool");
  const hasPromptedReceipt = invocation.messages.some((message) => /DETERMINISTIC TOOL RECEIPT/.test(message.content));
  const checks = [
    { id: "registered-profile", passed: report.compatibilityProfileId === profile.id,
      evidence: report.compatibilityProfileId + "/" + profile.id },
    { id: "prompt-placement", passed: report.promptPlacement === profile.chat.promptPlacement,
      evidence: report.promptPlacement },
    { id: "reasoning-control",
      passed: profile.reasoning.control !== "enable_thinking"
        || invocation.tokenizerEncodeOptions?.enable_thinking === (profile.reasoning.enabledForBenchmark ?? false),
      evidence: JSON.stringify(invocation.tokenizerEncodeOptions ?? {}) },
    { id: "tool-schema-rendering",
      passed: profile.tools.mode !== "native-template" || Boolean(invocation.tokenizerEncodeOptions?.tools),
      evidence: profile.tools.mode + "/" + invocation.toolCallFormat },
    { id: "tool-result-rendering",
      passed: profile.tools.mode === "native-template" ? hasNativeToolMessage : hasPromptedReceipt,
      evidence: profile.tools.mode === "native-template" ? "native tool role" : "prompted receipt" },
    { id: "tool-call-normalization", passed: sameTurn(parseAdapterOutput(candidate, encoded).turn, expectedTurn),
      evidence: encoded },
    { id: "decoding-profile",
      passed: invocation.settings.doSample === resolveGenerationProfile(profile.profiles.tool).doSample,
      evidence: JSON.stringify(invocation.settings) },
  ];
  return { passed: checks.every((check) => check.passed), checks };
}
