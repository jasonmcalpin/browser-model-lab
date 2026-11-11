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

A model card owns facts about one concrete artifact/configuration: model ID, revision, dtype, pipeline kind, family, adapter/profile reference, template mode, approximate artifact size, run ordering, and optional notes/tags.

A compatibility profile owns executable protocol behavior shared by compatible models: generation settings, native chat-template rules, tool-call syntax, reasoning controls, runtime/model classes, and normalization.

That separation is deliberate. A contributor can test another model against an existing protocol with only a card. A new protocol still requires reviewed runtime code instead of embedding executable behavior in untrusted JSON.

## Discovery invariants

- Every JSON file under `testing/` is a model card.
- Every active candidate ID is unique.
- At most one active card is marked default.
- Active run order is deterministic.
- Archive cards are inert.
- The browser and CLI derive their inventory from the same directory contract.
- Artifacts identify the tested model by candidate ID and benchmark git revision, so card changes remain traceable.
