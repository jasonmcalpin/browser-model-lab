import { createArcanAI, parseModelCard } from "arcanai";
import { transformersJsPlugin } from "arcanai/plugins/transformersjs";
import { arcanaiCardForInvocation } from "./arcanaiCardBridge";
import type { BrowserModelCandidate, GenerationMetrics, ModelInvocation } from "./types";
import type { ModelRuntime } from "./modelRuntime";
import type { TextStreamer } from "@huggingface/transformers";

/** The host owns its benchmark life cycle, weights, tokenization and scoring. */
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
}

type StreamerFactory = (callbacks: {
  onText(text: string): void;
  onToken(): void;
}) => TextStreamer;

/** Reuse the exact initialized model and tokenizer for Node and browser workers. */
export function createArcanAIModelExecutor(
  candidate: BrowserModelCandidate,
  modelRuntime: ModelRuntime,
  makeStreamer: StreamerFactory,
  stoppingCriteria: { interrupt(): void; reset(): void }
): ArcanAIModelExecutor {
  const engine = createArcanAI("off");
  let observer: StreamCallbacks | undefined;
  let inFlight = false;
  let emittedTokens = 0;

  engine.register({
    id: candidate.id,
    plugin: transformersJsPlugin({
      runtime: modelRuntime,
      stoppingCriteria,
      createStreamer({ onText, onToken }) {
        return makeStreamer({
          onText(text) {
            onText(text);
            observer?.onText?.(text, emittedTokens);
          },
          onToken() {
            onToken();
            emittedTokens++;
            observer?.onToken?.(emittedTokens);
          }
        });
      }
    })
  });

  return {
    async generate(invocation, signal, callbacks) {
      if (inFlight) throw new Error("ArcanAI benchmark instance is already executing");
      inFlight = true;
      emittedTokens = 0;
      observer = callbacks;
      try {
        const card = parseModelCard(arcanaiCardForInvocation(candidate, invocation));
        const started = performance.now();
        const result = await engine.generate({
          card,
          messages: invocation.messages.map(message => ({
            role: message.role,
            content: message.content
          })),
          signal,
          diagnostics: "off",
          timers: { heartbeatMs: 5000 }
        });
        const elapsedMs = performance.now() - started;
        if (result.status !== "success") {
          throw new Error(`ArcanAI execution failed (${result.status}, ${result.error?.code ?? "unknown"}): ${result.error?.message ?? "No error provided"}`);
        }
        const metadata = result.providerMetadata ?? {};
        const count = metadata.generatedTokens;
        if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) {
          throw new Error("ArcanAI provider returned invalid generated token count");
        }
        const firstToken = metadata.firstTokenMs;
        const metrics: GenerationMetrics = {
          ...(typeof firstToken === "number" ? { firstTokenMs: firstToken } : {}),
          generationMs: elapsedMs,
          generatedTokens: count,
          tokensPerSecond: elapsedMs > 0 ? count / (elapsedMs / 1000) : 0,
          termination: metadata.termination === "TOKEN_LIMIT" ? "TOKEN_LIMIT" : "UNKNOWN"
        };
        return { raw: result.text ?? "", metrics };
      } finally {
        inFlight = false;
        observer = undefined;
      }
    }
  };
}
