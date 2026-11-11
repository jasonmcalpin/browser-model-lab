import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

export function loadModelCardInventory(root, directory = "testing") {
  const cardDirectory = path.resolve(root, directory);
  const filenames = readdirSync(cardDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort();
  if (!filenames.length) throw new Error(`No model cards found in ${directory}/.`);

  const cards = filenames.map((filename) => {
    const absolutePath = path.join(cardDirectory, filename);
    let card;
    try { card = JSON.parse(readFileSync(absolutePath, "utf8")); }
    catch (error) { throw new Error(`Invalid JSON model card ${directory}/${filename}: ${error instanceof Error ? error.message : String(error)}`); }
    if (card?.schemaVersion !== 1 || !card.candidate || typeof card.candidate.id !== "string" || !card.candidate.id)
      throw new Error(`Invalid model card contract: ${directory}/${filename}`);
    if (card.default !== undefined && typeof card.default !== "boolean")
      throw new Error(`Invalid default flag: ${directory}/${filename}`);
    if (card.runOrder !== undefined && (!Number.isInteger(card.runOrder) || card.runOrder < 0))
      throw new Error(`Invalid runOrder: ${directory}/${filename}`);
    return { filename, ...card };
  });

  const ids = new Set();
  for (const card of cards) {
    if (ids.has(card.candidate.id)) throw new Error(`Duplicate active model candidate id: ${card.candidate.id}`);
    ids.add(card.candidate.id);
  }
  const defaults = cards.filter((card) => card.default === true);
  if (defaults.length > 1) throw new Error(`Multiple default model cards: ${defaults.map((card) => card.candidate.id).join(", ")}`);

  cards.sort((left, right) => (left.runOrder ?? Number.MAX_SAFE_INTEGER) - (right.runOrder ?? Number.MAX_SAFE_INTEGER)
    || left.candidate.id.localeCompare(right.candidate.id));
  return {
    cards,
    candidateIds: cards.map((card) => card.candidate.id),
    defaultCandidateId: defaults[0]?.candidate.id ?? cards[0].candidate.id,
  };
}
