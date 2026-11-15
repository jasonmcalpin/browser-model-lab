import { parseModelCard, type ModelPlugin } from "arcanai";
import { loadTransformersJsInstance } from "arcanai/plugins/transformersjs";
import { arcanaiCardForCandidate } from "./arcanaiCardBridge";
import type { BrowserModelCandidate, ModelMessage } from "./types";

/**
 * BML only bridges its historical benchmark card to an ArcanAI-owned runtime.
 * All model construction, tokenizer rendering, provider inference, vision
 * preprocessing and teardown are implemented in ArcanAI's Transformers plugin.
 */
export interface ModelRuntime {
  readonly tokenizer: unknown;
  readonly templateSource: string | undefined;
  readonly plugin: ModelPlugin;
  readonly stoppingCriteria: { interrupt(): void; reset(): void };
  renderPrompt(messages: readonly ModelMessage[], tokenizerOptions?: Readonly<Record<string, unknown>>): string;
  generate(messages: readonly ModelMessage[], options: Record<string, unknown>): Promise<unknown>;
  generateVision?(imageUrl: string, prompt: string, options: Record<string, unknown>): Promise<unknown>;
  observe(callbacks?: { onText?(text: string): void; onToken?(): void }): void;
  dispose(): Promise<void>;
}

type TransformersRuntime = typeof import("@huggingface/transformers");
type Progress = (progress: { status?: string; file?: string; loaded?: number }) => void;

export async function createModelRuntime(runtime: TransformersRuntime, candidate: BrowserModelCandidate,
  progressCallback: Progress): Promise<ModelRuntime> {
  const card = parseModelCard(arcanaiCardForCandidate(candidate));
  const loaded = await loadTransformersJsInstance(card, {
    sdk: runtime,
    onProgress: progressCallback
  });
  return {
    tokenizer: loaded.runtime.tokenizer,
    get templateSource() { return loaded.runtime.templateSource; },
    plugin: loaded.plugin,
    stoppingCriteria: loaded.stoppingCriteria,
    renderPrompt(messages, tokenizerOptions) {
      return loaded.runtime.renderPrompt(messages, tokenizerOptions);
    },
    generate(messages, options) { return loaded.runtime.generate(messages, options); },
    ...(loaded.runtime.generateVision ? {
      generateVision(imageUrl: string, prompt: string, options: Record<string, unknown>) {
        return loaded.runtime.generateVision!(imageUrl, prompt, options);
      }
    } : {}),
    observe(callbacks) { loaded.observe(callbacks); },
    dispose() { return loaded.dispose(); }
  };
}
