import { compatibilityProfileFor } from "./compatibilityProfiles";
import type { AdapterConformanceResult, BrowserModelCandidate, CompatibilityQualification } from "./types";

export function qualifyCompatibility(input: {
  readonly candidate: BrowserModelCandidate;
  readonly adapterConformance: AdapterConformanceResult;
  readonly initializationAttempted: boolean;
  readonly initialized: boolean;
  readonly initializationError?: string;
}): CompatibilityQualification {
  const profile = compatibilityProfileFor(input.candidate);
  const checks = [
    { id: "C1-loader", passed: input.initialized,
      evidence: input.initialized ? `${profile.runtime.kind} initialized`
        : input.initializationError ?? (input.initializationAttempted ? "initialization failed" : "not attempted") },
    { id: "C2-template", passed: profile.chat.renderer === "tokenizer-template",
      evidence: `chat renderer: ${profile.chat.renderer}` },
    { id: "C3-system-role", passed: ["preserve-roles", "user-only"].includes(profile.chat.promptPlacement),
      evidence: profile.chat.promptPlacement },
    { id: "C4-reasoning-mode", passed: profile.reasoning.defaultMode !== undefined,
      evidence: JSON.stringify(profile.reasoning) },
    { id: "C5-tool-schema", passed: profile.tools.mode !== "native-template" || profile.tools.tokenizerTools,
      evidence: JSON.stringify(profile.tools) },
    { id: "C6-tool-parser", passed: input.adapterConformance.checks.find((check) => check.id === "tool-call-normalization")?.passed ?? false,
      evidence: input.adapterConformance.checks.find((check) => check.id === "tool-call-normalization")?.evidence ?? "missing" },
    { id: "C7-tool-result", passed: input.adapterConformance.checks.find((check) => check.id === "tool-result-rendering")?.passed ?? false,
      evidence: input.adapterConformance.checks.find((check) => check.id === "tool-result-rendering")?.evidence ?? "missing" },
    { id: "C8-multi-turn-transport", passed: true,
      evidence: profile.tools.mode === "native-template" ? "native tool-role continuation" : "prompted receipt continuation" },
    { id: "C9-generation-profile", passed: input.adapterConformance.checks.find((check) => check.id === "decoding-profile")?.passed ?? false,
      evidence: JSON.stringify(profile.profiles) },
    { id: "C10-history-policy", passed: true, evidence: profile.chat.historyReasoning },
  ];

  let state: CompatibilityQualification["state"];
  if (!input.adapterConformance.passed) state = "INVALID_INTEGRATION";
  else if (!input.initialized) state = input.initializationAttempted ? "RUNTIME_BLOCKED" : "UNSUPPORTED_RUNTIME";
  else if (profile.tools.mode === "native-template") state = "COMPATIBLE";
  else if (profile.tools.mode === "prompted-protocol") state = "COMPATIBLE_WITH_PROMPTED_TOOLS";
  else state = "NO_NATIVE_TOOL_CONTRACT";

  return { state, profileId: profile.id, checks };
}

export function qualityScoringAllowed(qualification: CompatibilityQualification): boolean {
  return qualification.state === "COMPATIBLE"
    || qualification.state === "COMPATIBLE_WITH_PROMPTED_TOOLS"
    || qualification.state === "NO_NATIVE_TOOL_CONTRACT";
}
