import { createArcanAI, parseModelCard } from "arcanai";
import { arcanaiCardForInvocation, arcanaiCardForVisionInvocation } from "./arcanaiCardBridge";
import type { BrowserModelCandidate, GenerationMetrics, ModelInvocation, VisionInvocation } from "./types";
import type { ModelRuntime } from "./modelRuntime";

export interface ArcanAIGeneration {
  readonly raw: string;
  readonly metrics: GenerationMetrics;
}
export interface StreamCallbacks {
  readonly onText?: (text: string, tokenCount: number) => void;
  readonly onToken?: (tokenCount: number) => void;
}
export interface ArcanAIModelExecutor {
  generate(invocation: ModelInvocation, signal: AbortSignal, callbacks?: StreamCallbacks): Promise<ArcanAIGeneration>;
  generateVision(invocation: VisionInvocation, signal: AbortSignal, callbacks?: StreamCallbacks): Promise<ArcanAIGeneration>;
}

function normalizeMetrics(metadata: Record<string, unknown>, elapsedMs: number): GenerationMetrics {
  const count = metadata.generatedTokens;
  if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) {
    throw new Error("ArcanAI provider returned invalid generated token count");
  }
  const first = metadata.firstTokenMs;
  return {
    ...(typeof first === "number" && Number.isFinite(first) ? { firstTokenMs: first } : {}),
    generationMs: elapsedMs,
    generatedTokens: count,
    tokensPerSecond: elapsedMs > 0 ? count / (elapsedMs / 1000) : 0,
    termination: metadata.termination === "TOKEN_LIMIT" ? "TOKEN_LIMIT" : "UNKNOWN"
  };
}

/**
 * BML owns benchmark observation and scoring. ArcanAI owns the already loaded
 * model, plugin, model invocation, and image preprocessing.
 */
export function createArcanAIModelExecutor(
  candidate: BrowserModelCandidate,
  modelRuntime: ModelRuntime
): ArcanAIModelExecutor {
  const engine = createArcanAI("off");
  engine.register({ id: candidate.id, plugin: modelRuntime.plugin });
  let inFlight = false;

  async function execute(
    card: ReturnType<typeof arcanaiCardForInvocation> | ReturnType<typeof arcanaiCardForVisionInvocation>,
    messages: Array<{ role: "system" | "user" | "assistant" | "tool"; content: string | Array<{ type: "text"; text: string } | { type: "image"; source: { type: "url"; url: string } }> }>,
    signal: AbortSignal,
    callbacks?: StreamCallbacks
  ): Promise<ArcanAIGeneration> {
    if (inFlight) throw new Error("ArcanAI benchmark instance is already executing");
    inFlight = true;
    let generatedTokens = 0;
    modelRuntime.observe({
      onText(text) { try { callbacks?.onText?.(text, generatedTokens); } catch { /* observational */ } },
      onToken() {
        generatedTokens++;
        try { callbacks?.onToken?.(generatedTokens); } catch { /* observational */ }
      }
    });
    try {
      const started = performance.now();
      const result = await engine.generate({
        card: parseModelCard(card),
        messages, signal, diagnostics: "off", timers: { heartbeatMs: 5000 }
      });
      const elapsedMs = performance.now() - started;
      if (result.status !== "success") {
        throw new Error(`ArcanAI execution failed (${result.status}, ${result.error?.code ?? "unknown"}): ${result.error?.message ?? "No error provided"}`);
      }
      return { raw: result.text ?? "", metrics: normalizeMetrics(result.providerMetadata ?? {}, elapsedMs) };
    } finally {
      modelRuntime.observe();
      inFlight = false;
    }
  }

  return {
    generate(invocation, signal, callbacks) {
      return execute(arcanaiCardForInvocation(candidate, invocation),
        invocation.messages.map(message => ({ role: message.role, content: message.content })),
        signal, callbacks);
    },
    generateVision(invocation, signal, callbacks) {
      return execute(arcanaiCardForVisionInvocation(candidate, invocation),
        [{ role: "user", content: [
          { type: "text", text: invocation.prompt },
          { type: "image", source: { type: "url", url: invocation.imageUrl } }
        ] }], signal, callbacks);
    }
  };
}
