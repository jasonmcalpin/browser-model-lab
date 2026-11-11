import type { BrowserModelCandidate, ModelCompatibilityProfile } from "./types";

export const MODEL_CARD_SCHEMA_VERSION = 3 as const;

export interface BrowserModelCard {
  readonly schemaVersion: typeof MODEL_CARD_SCHEMA_VERSION;
  readonly default?: boolean;
  readonly runOrder?: number;
  readonly tags?: readonly string[];
  readonly notes?: readonly string[];
  readonly candidate: BrowserModelCandidate;
}

type ModelCardModuleMap = Readonly<Record<string, unknown>>;

const EXECUTABLE_KEY = /^(?:code|script|javascript|function|eval|module|import|require|hook|handler|callback|transform)$/i;
const EXECUTABLE_TEXT = /(?:=>|\bfunction\s*\(|\beval\s*\(|\bnew\s+Function\b|\brequire\s*\(|\bimport\s*\(|<script\b|javascript:)/i;

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}
function onlyKeys(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
  const permitted = new Set(allowed);
  for (const key of Object.keys(value)) if (!permitted.has(key)) throw new Error(`${label} contains unsupported field: ${key}`);
}
function rejectExecutableContent(value: unknown, path = "card"): void {
  if (typeof value === "string") {
    if (EXECUTABLE_TEXT.test(value)) throw new Error(`${path} contains executable-looking content.`);
    return;
  }
  if (Array.isArray(value)) { value.forEach((entry, index) => rejectExecutableContent(entry, `${path}[${index}]`)); return; }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (EXECUTABLE_KEY.test(key)) throw new Error(`${path} contains forbidden executable field: ${key}`);
    rejectExecutableContent(child, `${path}.${key}`);
  }
}
function validateGenerationProfile(value: unknown, label: string): void {
  const profile = object(value, label);
  onlyKeys(profile, ["doSample", "temperature", "topP", "topK", "presencePenalty", "repetitionPenalty", "minP"], label);
  for (const [key, entry] of Object.entries(profile)) {
    if (entry === "auto") continue;
    if (key === "doSample" ? typeof entry !== "boolean" : typeof entry !== "number")
      throw new Error(`${label}.${key} must be a concrete value or "auto".`);
  }
}
function validateCompatibilityProfile(value: unknown, label: string): ModelCompatibilityProfile {
  const profile = object(value, label);
  onlyKeys(profile, ["id", "family", "runtime", "chat", "tools", "reasoning", "profiles", "visionProfile", "adapterId", "sources"], label);

  const runtime = object(profile.runtime, `${label}.runtime`);
  onlyKeys(runtime, ["kind", "pipelineTask", "modelClass", "processorClass", "dtype", "minimumTransformersJs"], `${label}.runtime`);
  const dtype = runtime.dtype;
  if (dtype && typeof dtype === "object" && !Array.isArray(dtype))
    onlyKeys(dtype as Record<string, unknown>, ["embed_tokens", "vision_encoder", "decoder_model_merged"], `${label}.runtime.dtype`);

  const chat = object(profile.chat, `${label}.chat`);
  onlyKeys(chat, ["renderer", "promptPlacement", "historyReasoning", "userOnlyFormatting"], `${label}.chat`);
  if (chat.userOnlyFormatting !== undefined) {
    const format = object(chat.userOnlyFormatting, `${label}.chat.userOnlyFormatting`);
    onlyKeys(format, ["systemTemplate", "messageTemplate", "toolTemplate", "separator"], `${label}.chat.userOnlyFormatting`);
  }
  const tools = object(profile.tools, `${label}.tools`);
  onlyKeys(tools, ["mode", "callFormat", "callParser", "tokenizerTools", "definitionFormat", "promptedProtocol"], `${label}.tools`);
  if (tools.promptedProtocol !== undefined) {
    const protocol = object(tools.promptedProtocol, `${label}.tools.promptedProtocol`);
    onlyKeys(protocol, ["systemTemplate", "toolResultTemplate"], `${label}.tools.promptedProtocol`);
  }
  const reasoning = object(profile.reasoning, `${label}.reasoning`);
  onlyKeys(reasoning, ["supported", "defaultMode", "control", "enabledForBenchmark", "promptSuffix"], `${label}.reasoning`);

  const profiles = object(profile.profiles, `${label}.profiles`);
  onlyKeys(profiles, ["production", "direct", "tool"], `${label}.profiles`);
  validateGenerationProfile(profiles.production, `${label}.profiles.production`);
  validateGenerationProfile(profiles.direct, `${label}.profiles.direct`);
  validateGenerationProfile(profiles.tool, `${label}.profiles.tool`);
  if (profile.visionProfile !== undefined) validateGenerationProfile(profile.visionProfile, `${label}.visionProfile`);
  if (profile.sources !== undefined && (!Array.isArray(profile.sources) || profile.sources.some((entry) => typeof entry !== "string")))
    throw new Error(`${label}.sources must be an array of strings.`);
  return profile as unknown as ModelCompatibilityProfile;
}

export function parseBrowserModelCard(value: unknown, source = "model card"): BrowserModelCard {
  rejectExecutableContent(value, source);
  const card = object(value, source);
  onlyKeys(card, ["schemaVersion", "default", "runOrder", "tags", "notes", "candidate"], source);
  if (card.schemaVersion !== MODEL_CARD_SCHEMA_VERSION)
    throw new Error(`${source} uses unsupported schemaVersion ${String(card.schemaVersion)}.`);
  if (card.default !== undefined && typeof card.default !== "boolean") throw new Error(`${source}.default must be boolean.`);
  if (card.runOrder !== undefined && (!Number.isInteger(card.runOrder) || Number(card.runOrder) < 0))
    throw new Error(`${source}.runOrder must be a non-negative integer.`);
  for (const field of ["tags", "notes"] as const) {
    const list = card[field];
    if (list !== undefined && (!Array.isArray(list) || list.some((entry) => typeof entry !== "string")))
      throw new Error(`${source}.${field} must be an array of strings.`);
  }

  const candidate = object(card.candidate, `${source}.candidate`);
  onlyKeys(candidate, ["id", "label", "modelId", "revision", "backend", "dtype", "pipelineTask", "family",
    "adapterId", "compatibilityProfileId", "approximateArtifactBytes", "template", "structuredOutput", "compatibilityProfile"],
    `${source}.candidate`);
  if (typeof candidate.id !== "string" || !candidate.id.trim()) throw new Error(`${source} has no candidate id.`);
  const template = object(candidate.template, `${source}.candidate.template`);
  onlyKeys(template, ["kind", "enableThinking"], `${source}.candidate.template`);
  const compatibilityProfile = validateCompatibilityProfile(candidate.compatibilityProfile, `${source}.candidate.compatibilityProfile`);
  if (compatibilityProfile.id !== candidate.compatibilityProfileId)
    throw new Error(`${source} compatibility profile id does not match candidate.compatibilityProfileId.`);
  if (compatibilityProfile.adapterId !== candidate.adapterId)
    throw new Error(`${source} compatibility adapter does not match candidate.adapterId.`);
  if (compatibilityProfile.family !== candidate.family)
    throw new Error(`${source} compatibility family does not match candidate.family.`);
  return card as unknown as BrowserModelCard;
}

export function loadBrowserModelCards(modules: ModelCardModuleMap): readonly BrowserModelCard[] {
  const cards = Object.entries(modules).map(([source, value]) => parseBrowserModelCard(value, source));
  if (!cards.length) throw new Error("No active model cards were found under testing/.");
  const ids = new Set<string>();
  for (const card of cards) {
    if (ids.has(card.candidate.id)) throw new Error(`Duplicate model card candidate id: ${card.candidate.id}`);
    ids.add(card.candidate.id);
  }
  const defaults = cards.filter((card) => card.default === true);
  if (defaults.length > 1) throw new Error(`Multiple default model cards: ${defaults.map((card) => card.candidate.id).join(", ")}`);
  return cards.sort((left, right) => (left.runOrder ?? Number.MAX_SAFE_INTEGER) - (right.runOrder ?? Number.MAX_SAFE_INTEGER)
    || left.candidate.id.localeCompare(right.candidate.id));
}

const activeModules = import.meta.glob("../../testing/*.json", { eager: true, import: "default" }) as ModelCardModuleMap;
export const BROWSER_MODEL_CARDS = loadBrowserModelCards(activeModules);
export const DEFAULT_BROWSER_AI_CANDIDATE_ID =
  BROWSER_MODEL_CARDS.find((card) => card.default)?.candidate.id ?? BROWSER_MODEL_CARDS[0]!.candidate.id;
