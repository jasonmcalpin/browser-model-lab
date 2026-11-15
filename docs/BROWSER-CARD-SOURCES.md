# Browser model-card sources

BML's browser and Node paths consume the **same host-selected model-card files**. ArcanAI owns the filesystem enumeration boundary and the canonical model execution schema. BML retains validation of its historical v3 candidate cards and benchmark metadata during migration.

## Host selection

BML's Vite host resolves `BML_CARDS_DIR` at server/build startup (default `testing`). It may identify a repository-contained JSON directory or a single JSON file. The virtual `virtual:bml-model-cards` module contains that selected inventory, produced with ArcanAI's `readCardFilesSync({ root, path })` and interpreted by BML's existing strict card validator.

The browser has **no hard-coded import.meta.glob of testing/**. It cannot query arbitrary filesystem paths; changing the browser inventory is a host/build selection, not a URL parameter. This prevents a website visitor from browsing the developer's filesystem.

For manual browser UI use:

```sh
BML_CARDS_DIR=experiments/mara-dialogue pnpm dev
# or generate a production bundle with:
BML_CARDS_DIR=experiments/mara-dialogue pnpm build
```

For automated browser tests, the existing `--cards-dir` flag selects the identical inventory and passes it to Vite via `BML_CARDS_DIR`:

```sh
pnpm benchmark:browser-ai -- --cards-dir experiments/mara-dialogue --candidate qwen3-4b-q4f16-character --test production --cached
```

For Node tests the same flag feeds ArcanAI's root-bounded raw-card reader. The CLI no longer serializes the full selected model card into the browser URL; the selected browser manifest is authoritative.

## Invariants

- The host owns the path and access policy. ArcanAI and the plugin do not assume `testing` or `models`.
- The selected inventory is validated, ordered, and checked for duplicate candidate IDs in BML (v3) before being used.
- A missing/invalid source fails visibly rather than falling back to the default collection.
- No model loading, npm installation, plugin registration, or inference occurs during card discovery.
- ArcanAI model execution uses its canonical card after BML's historical v3 adapter; there is no browser-specific execution schema.
- Browser builds capture the selected manifest at build time. To change production inventory, rebuild/redeploy; a standalone browser cannot read a local filesystem path.

The remaining v3-to-v1 data migration is separate from the file source selection.
