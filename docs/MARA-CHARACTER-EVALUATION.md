# Mara character-interaction evaluation (MR1)

The benchmark already tests narrow persona instruction following (P1), Vince character-contract continuity (PF11), and a four-turn Vince sample (PF11B). **MR1 adds a separate five-turn, canon-grounded Mara Venn conversation without changing the existing 120-point production fitness score**. It exercises a different capability: whether a small model can inhabit a specific authored character naturally.

## Authored source and fixture

`src/benchmark/fixtures/mara-character.json` is a reviewed, versioned fixture derived from Code Gauntlet's `packages/missions/src/content/shared/mara-venn.json` and `mara-venn-encounter.json` at the time shown in the fixture. It is a **snapshot**, not an automatically synchronized dependency. Review source changes before updating the fixture, especially world/reveal constraints.

The test supplies a complete system/character contract and maintains an actual conversation history across five successive user turns. The model must respond to an absence explanation, reflect an interlocutor's challenge, resist a demand to grant game progression, reject an attempted identity/record/history rewrite, and maintain appropriate epistemic limits. Outputs and per-turn metrics travel through the existing production-fitness result artifact as `maraRoleplaySample`, independently of `roleplaySample` (Vince).

## Review protocol

MR1 is deliberately **human-review only**. A lexical scorer that merely checks for “Mara” or “18,263” would reward repetitive, artificial responses and miss personality drift. Review each transcript for:

1. Identity and restrained, precise voice.
2. Correct use of the employment record; player claims remain claims.
3. Resistance to player-side rewriting of identity, history, and authority.
4. Agency: can challenge, decline, question, and avoid becoming a helpful quest dispatcher.
5. Context continuity over turns without invented memories.
6. Reveal discipline: does not identify hidden office operators or explain unearned lore.
7. Dialogue naturalness; short answers when appropriate, no forced rigid format.

The full set of dimensions and hard failures is stored with the fixture, not duplicated in test implementation. Compare multiple candidates using the **same exact fixture**, generation settings and token budget. Archive transcripts, model and adapter versions, first-token latency, and review verdict with the benchmark results. A model is not approved for production Mara dialogue merely because it scores well on PF11 or tool calling.

## Scope and safety

The runtime generates **non-authoritative expression**. Game domain, stored records, progress, permissions, credentials, and deterministic outcomes remain outside the model. Keep the current Mara behavior as fallback while evaluating. No integration into Code Gauntlet's production actor UI is implemented by MR1.

## Verification

Test source was updated to assert both four-turn Vince and five-turn Mara results. Live model runs and a local test execution have not yet been performed as part of this documentation/fixture update.
