import { compatibilityProfileFor, resolveGenerationProfile } from "./compatibilityProfiles";
import type { AdapterProfileReport, BrowserModelCandidate, CanonicalGenerationRequest, CanonicalToolDefinition,
  ModelCompatibilityProfile, ModelInvocation, ModelMessage, ModelTurn, VisionInvocation } from "./types";

type TemplateValues = Readonly<Record<string, string>>;

function renderTemplate(template: string, values: TemplateValues): string {
  return template.replace(/\{\{([a-zA-Z][a-zA-Z0-9]*)\}\}/g, (_match, key: string) => values[key] ?? "");
}

function functionTools(tools: readonly CanonicalToolDefinition[]): readonly Record<string, unknown>[] {
  return tools.map((tool) => ({ type: "function", function: {
    name: tool.name, description: tool.description, parameters: tool.inputSchema,
  } }));
}

function toolDefinitions(profile: ModelCompatibilityProfile, tools: readonly CanonicalToolDefinition[]): string {
  if (profile.tools.definitionFormat !== "openai-functions")
    throw new Error(`Unsupported declarative tool definition format: ${String(profile.tools.definitionFormat)}`);
  return JSON.stringify(functionTools(tools));
}

function foldIntoUser(messages: readonly ModelMessage[], profile: ModelCompatibilityProfile): readonly ModelMessage[] {
  const format = profile.chat.userOnlyFormatting;
  if (!format) throw new Error(`Profile ${profile.id} uses user-only placement without chat.userOnlyFormatting.`);
  const rendered = messages.map((message) => {
    const template = message.role === "system" ? format.systemTemplate
      : message.role === "tool" ? format.toolTemplate : format.messageTemplate;
    return renderTemplate(template, {
      role: message.role.toUpperCase(),
      content: message.content,
      name: message.name ?? "",
    });
  }).filter(Boolean).join(format.separator);
  return [{ role: "user", content: rendered }];
}

function renderPromptedToolRoles(messages: readonly ModelMessage[], profile: ModelCompatibilityProfile): readonly ModelMessage[] {
  const protocol = profile.tools.promptedProtocol;
  if (!protocol) throw new Error(`Profile ${profile.id} requires tools.promptedProtocol for prompted tool use.`);
  return messages.map((message): ModelMessage => message.role === "tool"
    ? { role: "user", content: renderTemplate(protocol.toolResultTemplate, {
      content: message.content, name: message.name ?? "",
    }) }
    : message);
}

export function adapterReport(candidate: BrowserModelCandidate): AdapterProfileReport {
  const profile = compatibilityProfileFor(candidate);
  return {
    adapterId: profile.adapterId,
    promptPlacement: profile.chat.promptPlacement,
    toolCallFormat: profile.tools.callFormat,
    reasoningFormat: profile.reasoning.control === "forced-think-prefix" ? "think-tags" : "none",
    runtimeKind: profile.runtime.kind,
    toolSupportMode: profile.tools.mode,
    compatibilityProfileId: profile.id,
    ...(profile.reasoning.control === "enable_thinking" ? { tokenizerOptions: {
      enable_thinking: profile.reasoning.enabledForBenchmark ?? false,
      ...(profile.tools.tokenizerTools ? { tools: "native tool schemas supplied through tokenizer encode kwargs" } : {}),
    } } : {}),
    profiles: {
      production: resolveGenerationProfile(profile.profiles.production),
      direct: resolveGenerationProfile(profile.profiles.direct),
      tool: resolveGenerationProfile(profile.profiles.tool),
    },
    ...(profile.visionProfile ? { visionProfile: resolveGenerationProfile(profile.visionProfile) } : {}),
  };
}

export function buildVisionInvocation(candidate: BrowserModelCandidate, imageUrl: string,
  prompt: string, maxNewTokens = 96): VisionInvocation {
  const profile = compatibilityProfileFor(candidate);
  if (!profile.visionProfile) throw new Error(`Compatibility profile has no vision workload: ${profile.id}`);
  return {
    imageUrl, prompt, compatibilityProfileId: profile.id,
    settings: { maxNewTokens, ...resolveGenerationProfile(profile.visionProfile) },
  };
}

export function buildModelInvocation(candidate: BrowserModelCandidate, request: CanonicalGenerationRequest): ModelInvocation {
  const profile = compatibilityProfileFor(candidate);
  const tools = request.tools ?? [];
  let messages: readonly ModelMessage[] = request.messages;
  let tokenizerEncodeOptions: Readonly<Record<string, unknown>> | undefined;

  if (request.workload === "tool") {
    if (profile.tools.mode === "native-template") {
      tokenizerEncodeOptions = {
        ...(profile.reasoning.control === "enable_thinking"
          ? { enable_thinking: profile.reasoning.enabledForBenchmark ?? false } : {}),
        ...(tools.length ? { tools: functionTools(tools) } : {}),
      };
      if (profile.chat.promptPlacement === "user-only") messages = foldIntoUser(messages, profile);
    } else {
      const protocol = profile.tools.promptedProtocol;
      if (!protocol) throw new Error(`Profile ${profile.id} has no prompted tool protocol.`);
      const originalSystem = request.messages.filter((message) => message.role === "system")
        .map((message) => message.content).join("\n\n");
      const toolSystem = renderTemplate(protocol.systemTemplate, {
        tools: toolDefinitions(profile, tools),
        taskRules: originalSystem,
      });
      const nonSystem = request.messages.filter((message) => message.role !== "system");
      messages = profile.chat.promptPlacement === "user-only"
        ? foldIntoUser([{ role: "system", content: toolSystem }, ...request.messages], profile)
        : [{ role: "system", content: toolSystem }, ...nonSystem];
      if (profile.chat.promptPlacement !== "user-only") messages = renderPromptedToolRoles(messages, profile);
    }
  } else {
    if (profile.chat.promptPlacement === "user-only") messages = foldIntoUser(messages, profile);
    if (profile.reasoning.control === "enable_thinking")
      tokenizerEncodeOptions = { enable_thinking: profile.reasoning.enabledForBenchmark };
  }

  if (profile.reasoning.control === "forced-think-prefix") {
    if (!profile.reasoning.promptSuffix)
      throw new Error(`Profile ${profile.id} uses forced-think-prefix without reasoning.promptSuffix.`);
    messages = messages.map((message, index) => index === messages.length - 1
      ? { ...message, content: `${message.content}${profile.reasoning.promptSuffix}` }
      : message);
  }

  return {
    messages,
    ...(tokenizerEncodeOptions ? { tokenizerEncodeOptions } : {}),
    settings: { maxNewTokens: request.maxNewTokens, ...resolveGenerationProfile(profile.profiles[request.workload]),
      ...(request.generationOverrides ? resolveGenerationProfile(request.generationOverrides) : {}) },
    adapterId: profile.adapterId,
    toolCallFormat: profile.tools.callFormat,
    compatibilityProfileId: profile.id,
  };
}

function jsonValue(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  const candidate = fenced ?? (first >= 0 && last > first ? text.slice(first, last + 1) : undefined);
  if (!candidate) return undefined;
  try { return JSON.parse(candidate); } catch { return undefined; }
}

function normalizedTurn(value: unknown): ModelTurn | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  if (!first || typeof first !== "object") return undefined;
  const object = first as Record<string, unknown>;
  if (object.type === "tool_call" && object.call && typeof object.call === "object") {
    const call = object.call as Record<string, unknown>;
    if (typeof call.tool === "string" && call.args && typeof call.args === "object" && !Array.isArray(call.args))
      return { type: "tool_call", call: { tool: call.tool, args: call.args as Record<string, unknown> } };
  }
  const tool = typeof object.name === "string" ? object.name : object.tool;
  const args = object.arguments ?? object.args;
  if (typeof tool === "string" && args && typeof args === "object" && !Array.isArray(args))
    return { type: "tool_call", call: { tool, args: args as Record<string, unknown> } };
  if (object.type === "final" && "answer" in object) return { type: "final", answer: object.answer };
  return undefined;
}

function parseLfmToolCall(text: string): ModelTurn | undefined {
  const call = text.match(/<tool_call>\s*<function=([^>]+)>([\s\S]*?)<\/function>\s*<\/tool_call>/i);
  if (!call) return undefined;
  const args: Record<string, unknown> = {};
  const parameters = call[2]!.matchAll(/<parameter=([^>]+)>\s*([\s\S]*?)\s*<\/parameter>/gi);
  for (const parameter of parameters) {
    const raw = parameter[2]!.trim();
    try { args[parameter[1]!] = JSON.parse(raw); } catch { args[parameter[1]!] = raw; }
  }
  return { type: "tool_call", call: { tool: call[1]!.trim(), args } };
}

export function parseAdapterOutput(candidate: BrowserModelCandidate, raw: string): {
  readonly final: string; readonly reasoningTokens?: number; readonly turn?: ModelTurn;
} {
  const profile = compatibilityProfileFor(candidate);
  let final = raw.trim();
  let reasoningTokens: number | undefined;
  const thinkClose = final.lastIndexOf("</think>");
  if (thinkClose >= 0) {
    const reasoning = final.slice(0, thinkClose + "</think>".length);
    reasoningTokens = reasoning.trim().split(/\s+/).length;
    final = final.slice(thinkClose + "</think>".length).trim();
  }

  const parserTurn = profile.tools.callParser === "lfm3-xml" ? parseLfmToolCall(final) : undefined;
  const tagged = final.match(/<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/i)?.[1];
  let taggedValue: unknown;
  if (tagged) { try { taggedValue = JSON.parse(tagged); } catch { taggedValue = undefined; } }
  const turn = parserTurn ?? normalizedTurn(taggedValue) ?? normalizedTurn(jsonValue(final));
  return { final, ...(reasoningTokens === undefined ? {} : { reasoningTokens }), ...(turn ? { turn } : {}) };
}
