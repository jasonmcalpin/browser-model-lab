import type { ModelCompatibilityProfile, ModelMessage } from "./types";

export function renderFormattedPrompt(messages: readonly ModelMessage[],
  format: NonNullable<ModelCompatibilityProfile["chat"]["messageFormat"]>): string {
  const sections: string[] = [];
  if (format.defaultSystemMessage) sections.push(format.systemPrefix + format.defaultSystemMessage);
  for (const message of messages) {
    const prefix = message.role === "system" ? format.systemPrefix
      : message.role === "assistant" ? format.assistantPrefix
      : message.role === "tool" ? format.toolPrefix : format.userPrefix;
    sections.push(prefix + message.content);
  }
  return sections.join(format.separator) + format.separator + format.generationSuffix;
}
