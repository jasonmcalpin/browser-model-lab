import path from "node:path";
import { pathToFileURL } from "node:url";
import { arcanaiCardForInvocation } from "./arcanaiCardBridge";
import type { BrowserModelCandidate, ModelInvocation, GenerationMetrics } from "./types";
import type { ModelRuntime } from "./modelRuntime";

type TransformersModule = typeof import("@huggingface/transformers");

export interface ArcanAIOutput {
  raw: string;
  metrics: GenerationMetrics;
}

/**
 * Deliberately opt-in. No ArcanAI dependency is imported in the native path.
 * The local built SDK/plugin are resolved from a developer-provided folder.
 * A published package dependency will replace this loader after parity proof.
 */
export async function createArcanAINodeExecutor(
  candidate: BrowserModelCandidate,
  modelRuntime: ModelRuntime,
  transformers: TransformersModule,
  stoppingCriteria: { interrupt(): void; reset(): void }
): Promise<{ generate(invocation: ModelInvocation, signal: AbortSignal): Promise<ArcanAIOutput> }> {
  const root = process.env.BML_ARCANAI_ROOT;
  if (!root) throw new Error("Set BML_ARCANAI_ROOT to the built ArcanAI repo when using --executor arcanai.");
  const location = path.resolve(root);
  const coreFile = pathToFileURL(path.join(location, "dist/src/index.js")).href;
  const pluginFile = pathToFileURL(path.join(location, "plugins/transformersjs/dist/index.js")).href;
  const core = await import(/* @vite-ignore */ coreFile);
  const adapter = await import(/* @vite-ignore */ pluginFile);
  const engine = core.createArcanAI("off");

  engine.register({
    id: candidate.id,
    plugin: adapter.transformersJsPlugin({
      runtime: modelRuntime,
      stoppingCriteria,
      createStreamer({ onText, onToken }: { onText(text: string): void; onToken(): void }) {
        return new transformers.TextStreamer(modelRuntime.tokenizer as never, {
          skip_prompt: true,
          skip_special_tokens: true,
          callback_function: onText,
          token_callback_function: onToken
        });
      }
    })
  });

  return {
    async generate(invocation, signal) {
      const card = core.parseModelCard(arcanaiCardForInvocation(candidate, invocation));
      const started = performance.now();
      const result = await engine.generate({
        card,
        messages: invocation.messages,
        signal,
        diagnostics: "off",
        timers: { heartbeatMs: 5000 }
      });
      const wallMs = performance.now() - started;
      if (result.status !== "success") {
        throw new Error(`ArcanAI execution failed (${result.status}, ${result.error?.code ?? "unknown"}): ${result.error?.message ?? "No error provided"}`);
      }
      const metadata: Record<string, unknown> = result.providerMetadata ?? {};
      const count = metadata.generatedTokens;
      const generatedTokens = typeof count === "number" && Number.isFinite(count) ? count : 0;
      const firstToken = metadata.firstTokenMs;
      const termination = metadata.termination;
      const metrics: GenerationMetrics = {
        ...(typeof firstToken === "number" ? { firstTokenMs: firstToken } : {}),
        generationMs: wallMs,
        generatedTokens,
        tokensPerSecond: wallMs > 0 ? generatedTokens / (wallMs / 1000) : 0,
        termination: termination === "TOKEN_LIMIT" ? "TOKEN_LIMIT" : "UNKNOWN"
      };
      return { raw: result.text ?? "", metrics };
    }
  };
}
