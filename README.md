# Proof of Risk

`Proof of Risk: Academy Gambit` is an original strategy-game MVP about deterministic risk games, replayable audit evidence, and verifiable fairness primitives.

The current implementation is Phase 0 from the roadmap in issue #1: engineering skeleton and deterministic engine foundation.

## IP and Compliance Boundary

- This project uses original naming, UI, and code.
- Design research under `audits/kakegurui_zk_game_design_pack/` is local reference material and must not be committed.
- The MVP uses virtual game resources only. Real-money gambling, redeemable tokens, prizes, or regulated betting flows are out of scope unless a separate legal/compliance review is completed.

## Setup

```bash
npm install
npm run dev
```

## Verification

```bash
npm test
npm run build
```

## Architecture

Phase 0 establishes reusable engine primitives:

- `src/engine/rng.ts`: seeded deterministic RNG with append-only `randomLog` records.
- `src/engine/stateMachine.ts`: generic ruleset, state, action, settlement, and audit interfaces.
- `src/engine/actionLog.ts`: append-only action records chained by stable hashes.
- `src/engine/commitments.ts`: canonical commit/reveal helpers for hidden choices.
- `src/engine/audit.ts`: fairness and anomaly report types.
- `src/engine/replay.ts`: replay envelopes and stable replay hashing.

The React UI in `src/App.tsx` only displays a Phase 0 foundation demo from `src/demo.ts`. It does not implement settlement or game rules.

## Determinism Contract

- Same seed plus same logged events must produce the same replay hash.
- Different seed or action order must produce a different replay hash.
- All random operations must be made through `DeterministicRng`.
- Hidden choices should be represented as commitments until their reveal or proof phase.

## Known Issues

- The Phase 0 hash and RNG stack is development-grade. Later phases should add stronger domain separation and independent verifier fixtures.
- No real gamble ruleset is implemented yet. Phase 1 adds the data-driven catalog and Phase 2 adds the first playable ruleset.
- ZK circuits are intentionally out of the Phase 0 critical path.

## Next Interfaces

Phase 1 should consume the engine primitives without moving rule logic into UI components. Catalog data should be normalized into original runtime names before display.
