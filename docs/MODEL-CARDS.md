# Model-card inventory

Browser Model Lab treats model membership as repository data rather than source-code registration.

## Active and archived sets

`testing/*.json` is the complete active inventory. Both the browser bundle and CLI discover those cards automatically. `archive/*.json` is never loaded by normal runs.

This creates a contribution contract:

1. choose an existing compatibility profile that matches the model's runtime/chat/tool protocol;
2. add one model card to `testing/`;
3. open a PR;
4. CI validates the repository and the next `--candidate all` run includes the model automatically.

No candidate registry or CLI ID list is edited.

To retire a candidate without losing its specification, move the card from `testing/` to `archive/`. Reactivation is the reverse move.

## Card versus compatibility profile

A model card owns the complete declarative configuration used by the tested models: model ID/revision, runtime kind and dtype, chat-role handling, tool mode and known call format, reasoning controls, generation settings, optional vision settings, template metadata, run ordering, and notes/tags.

The adapter engine remains code, but it is generic and finite. Cards choose among the formatting/runtime primitives BML already implements; there is no model-specific compatibility registry.

Generation fields accept either a concrete value or `"auto"`. `"auto"` means BML omits that override and allows Transformers.js/model configuration to use its native default. It does not mean heuristic guessing.

### Card safety

Model cards are data only. BML never evaluates JavaScript, functions, expressions, callbacks, imports, modules, hooks, or arbitrary parser code from a card. Unknown fields and executable-looking content are rejected before model initialization. The Node CLI rejects such a card before Chrome is launched, and the browser loader validates it again.

## Discovery invariants

- Every JSON file under `testing/` is a model card.
- Every active candidate ID is unique.
- At most one active card is marked default.
- Active run order is deterministic.
- Archive cards are inert.
- The browser and CLI derive their inventory from the same directory contract.
- Artifacts identify the tested model by candidate ID and benchmark git revision, so card changes remain traceable.
