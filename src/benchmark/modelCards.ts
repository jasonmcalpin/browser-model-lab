import type { BrowserModelCandidate } from "./types";

export const MODEL_CARD_SCHEMA_VERSION = 1 as const;

export interface BrowserModelCard {
  readonly schemaVersion: typeof MODEL_CARD_SCHEMA_VERSION;
  readonly default?: boolean;
  readonly runOrder?: number;
  readonly tags?: readonly string[];
  readonly notes?: readonly string[];
  readonly candidate: BrowserModelCandidate;
}

type ModelCardModuleMap = Readonly<Record<string, unknown>>;

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

export function parseBrowserModelCard(value: unknown, source = "model card"): BrowserModelCard {
  const card = object(value, source);
  if (card.schemaVersion !== MODEL_CARD_SCHEMA_VERSION)
    throw new Error(`${source} uses unsupported schemaVersion ${String(card.schemaVersion)}.`);
  const candidate = object(card.candidate, `${source}.candidate`) as unknown as BrowserModelCandidate;
  if (typeof candidate.id !== "string" || !candidate.id.trim()) throw new Error(`${source} has no candidate id.`);
  if (card.default !== undefined && typeof card.default !== "boolean") throw new Error(`${source}.default must be boolean.`);
  if (card.runOrder !== undefined && (!Number.isInteger(card.runOrder) || Number(card.runOrder) < 0))
    throw new Error(`${source}.runOrder must be a non-negative integer.`);
  for (const field of ["tags", "notes"] as const) {
    const list = card[field];
    if (list !== undefined && (!Array.isArray(list) || list.some((entry) => typeof entry !== "string")))
      throw new Error(`${source}.${field} must be an array of strings.`);
  }
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
