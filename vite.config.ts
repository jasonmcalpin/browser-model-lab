import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, relative } from "node:path";
import { readCardFilesSync } from "arcanai/node/cards";

const VIRTUAL_ID = "virtual:bml-model-cards";
const RESOLVED_ID = "\0" + VIRTUAL_ID;
const repositoryRoot = dirname(fileURLToPath(import.meta.url));

/**
 * BML supplies the source; ArcanAI provides the host-bounded file reader.
 * Both browser UI and browser CLI use this manifest. The browser never
 * accepts a filesystem path supplied through URL search parameters.
 */
function selectedBrowserCards(): Plugin {
  const selectedPath = process.env.BML_CARDS_DIR ?? "testing";
  return {
    name: "bml-host-selected-cards",
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
    },
    load(id) {
      if (id !== RESOLVED_ID) return;
      const files = readCardFilesSync({ root: repositoryRoot, path: selectedPath });
      if (!files.length) throw new Error(`No model cards found in ${selectedPath}.`);
      const cards = Object.fromEntries(files.map(file => [
        relative(repositoryRoot, file.path).replaceAll("\\", "/"),
        file.value
      ]));
      return `export default ${JSON.stringify(cards)};`;
    },
  };
}

export default defineConfig({
  plugins: [selectedBrowserCards(), react()],
});
