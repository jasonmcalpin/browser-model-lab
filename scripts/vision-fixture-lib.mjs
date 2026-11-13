import { existsSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";

export function loadVisionFixtures(repoRoot, fixturePaths) {
  if (!Array.isArray(fixturePaths) || !fixturePaths.length)
    throw new Error("Vision fixtures must be a nonempty array of JSON paths.");
  const root = realpathSync(repoRoot);
  const entries = [];
  const ids = new Set();
  for (const file of fixturePaths) {
    if (typeof file !== "string" || !file.endsWith(".json") || path.isAbsolute(file)
      || file.split(/[\\/]/).some(part => !part || part === ".." || part === "."))
      throw new Error("Invalid vision fixture path: " + String(file));
    const resolved = path.resolve(root, file);
    if (!resolved.startsWith(root + path.sep) || !existsSync(resolved)
      || !realpathSync(resolved).startsWith(root + path.sep))
      throw new Error("Vision fixture is missing or outside repository: " + file);
    const data = JSON.parse(readFileSync(resolved, "utf8"));
    if (!data || typeof data !== "object" || Array.isArray(data)
      || Object.keys(data).some(k => !["schemaVersion", "id", "image", "prompt", "expected", "scorer", "trials", "maxNewTokens", "scorers", "acceptedTerms", "semanticEquivalents"].includes(k))
      || data.schemaVersion !== 1 || typeof data.id !== "string" || !/^[a-z0-9][a-z0-9._-]{0,79}$/.test(data.id)
      || typeof data.prompt !== "string" || !data.prompt.trim() || data.prompt.length > 2000
      || typeof data.expected !== "string" || !data.expected.trim() || data.expected.length > 1000
      || data.scorer !== "normalized-exact"
      || (data.scorers !== undefined && (!Array.isArray(data.scorers) || !data.scorers.length || data.scorers[0] !== "normalized-exact" || new Set(data.scorers).size !== data.scorers.length || data.scorers.some(x => !["normalized-exact", "contains-term", "semantic-equivalent"].includes(x))))
      || (data.acceptedTerms !== undefined && (!Array.isArray(data.acceptedTerms) || !data.acceptedTerms.length || data.acceptedTerms.some(x => typeof x !== "string" || !x.trim() || x.length > 120)))
      || (data.semanticEquivalents !== undefined && (!Array.isArray(data.semanticEquivalents) || !data.semanticEquivalents.length || data.semanticEquivalents.some(x => typeof x !== "string" || !x.trim() || x.length > 120)))
      || (Array.isArray(data.scorers) && data.scorers.includes("semantic-equivalent") && !Array.isArray(data.semanticEquivalents))
      || !Number.isInteger(data.trials) || data.trials < 1 || data.trials > 10
      || !Number.isInteger(data.maxNewTokens) || data.maxNewTokens < 16 || data.maxNewTokens > 768)
      throw new Error("Invalid vision fixture definition: " + file);
    if (ids.has(data.id)) throw new Error("Duplicate vision fixture id: " + data.id);
    ids.add(data.id);
    if (typeof data.image !== "string"
      || !/^\/artifacts\/[a-zA-Z0-9/_-]+\.(?:png|jpg|jpeg|webp|svg)$/.test(data.image)
      || data.image.includes(".."))
      throw new Error("Vision fixture image must be an owned public artifact: " + file);
    const imagePath = path.resolve(root, "public", data.image.slice(1));
    const publicRoot = path.resolve(root, "public");
    if (!imagePath.startsWith(publicRoot + path.sep) || !existsSync(imagePath)
      || !realpathSync(imagePath).startsWith(publicRoot + path.sep))
      throw new Error("Missing or unsafe vision fixture image: " + data.image);
    entries.push({ ...data, source: file });
  }
  return entries;
}
