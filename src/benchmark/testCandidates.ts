import { BROWSER_AI_BENCHMARK_CANDIDATES } from "./candidates";
import { loadBrowserModelCards } from "./modelCards";
import type { BrowserModelCandidate } from "./types";

const archivedModules = import.meta.glob("../../archive/*.json", { eager: true, import: "default" });
const archivedCandidates = Object.keys(archivedModules).length
  ? loadBrowserModelCards(archivedModules).map((card) => card.candidate) : [];

export const ALL_TEST_CANDIDATES: readonly BrowserModelCandidate[] = [
  ...BROWSER_AI_BENCHMARK_CANDIDATES,
  ...archivedCandidates,
];

export function testCandidateById(id: string): BrowserModelCandidate {
  const candidate = ALL_TEST_CANDIDATES.find((entry) => entry.id === id);
  if (!candidate) throw new Error(`Unknown test candidate: ${id}`);
  return candidate;
}
