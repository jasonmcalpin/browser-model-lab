import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
const EXECUTABLE_KEY = /^(?:code|script|javascript|function|eval|module|import|require|hook|handler|callback|transform)$/i;
const EXECUTABLE_TEXT = /(?:=>|\bfunction\s*\(|\beval\s*\(|\bnew\s+Function\b|\brequire\s*\(|\bimport\s*\(|<script\b|javascript:)/i;
function rejectExecutableContent(value, location = "card") {
  if (typeof value === "string") {
    if (EXECUTABLE_TEXT.test(value)) throw new Error(`${location} contains executable-looking content.`);
    return;
  }
  if (Array.isArray(value)) { value.forEach((entry, index) => rejectExecutableContent(entry, `${location}[${index}]`)); return; }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (EXECUTABLE_KEY.test(key)) throw new Error(`${location} contains forbidden executable field: ${key}`);
    rejectExecutableContent(child, `${location}.${key}`);
  }
}
export function loadModelCardInventory(root, directory = "testing") {
  const cardDirectory = path.resolve(root, directory);
  const relative = path.relative(path.resolve(root), cardDirectory);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative))
    throw new Error("Model-card directory must be a repository subdirectory.");
  const filenames = readdirSync(cardDirectory, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name).sort();
  if (!filenames.length) throw new Error(`No model cards found in ${directory}/.`);
  const cards = filenames.map((filename) => {
    const absolutePath = path.join(cardDirectory, filename);
    let card;
    try { card = JSON.parse(readFileSync(absolutePath, "utf8")); }
    catch (error) { throw new Error(`Invalid JSON model card ${directory}/${filename}: ${error instanceof Error ? error.message : String(error)}`); }
    rejectExecutableContent(card, `${directory}/${filename}`);
    if (card?.schemaVersion !== 3 || !card.candidate || typeof card.candidate.id !== "string" || !card.candidate.id || !card.candidate.compatibilityProfile)
      throw new Error(`Invalid model card contract: ${directory}/${filename}`);
    if (card.default !== undefined && typeof card.default !== "boolean") throw new Error(`Invalid default flag: ${directory}/${filename}`);
    if (card.runOrder !== undefined && (!Number.isInteger(card.runOrder) || card.runOrder < 0)) throw new Error(`Invalid runOrder: ${directory}/${filename}`);
    return card;
  });
  const ids = new Set();
  for (const card of cards) { if (ids.has(card.candidate.id)) throw new Error(`Duplicate active model candidate id: ${card.candidate.id}`); ids.add(card.candidate.id); }
  const defaults = cards.filter((card) => card.default === true);
  if (defaults.length > 1) throw new Error(`Multiple default model cards: ${defaults.map((card) => card.candidate.id).join(", ")}`);
  cards.sort((left, right) => (left.runOrder ?? Number.MAX_SAFE_INTEGER) - (right.runOrder ?? Number.MAX_SAFE_INTEGER)
    || left.candidate.id.localeCompare(right.candidate.id));
  return { cards, candidateIds: cards.map((card) => card.candidate.id), defaultCandidateId: defaults[0]?.candidate.id ?? cards[0].candidate.id };
}
