# Proof of Risk

`Proof of Risk: Academy Gambit` is an original strategy-game MVP about deterministic risk games, replayable audit evidence, and verifiable fairness primitives.

The current implementation covers:

- Phase 0 from roadmap issue #1: engineering skeleton and deterministic engine foundation.
- Phase 1 from roadmap issue #1: normalized, runtime-safe gamble catalog and Gamble Lab UI.
- Phase 2 from roadmap issue #1: playable Ballot RPS ruleset with committed votes, seeded draws, hidden play commit/reveal, NPC selection, settlement, and audit replay.
- Phase 3 from roadmap issue #1: playable Zero Nim ruleset with betting, bust threshold, hidden card commit/reveal, risk-aware NPC decisions, and audit-only anomaly signals.
- Phase 4 from roadmap issue #1: playable Greater Good public-goods ruleset with five-player hidden contributions, doubled common-pool distribution, elimination voting, archetype-driven NPCs, and audit replay.
- Phase 5 from roadmap issue #1: shared NPC archetypes, difficulty policy, deterministic simulation metrics, and balance snapshot UI.
- Phase 6 from roadmap issue #1: 2.5D visual vertical slice with academy map, perspective table, audit board, motion, responsive behavior, and UI smoke coverage.
- Phase 7 from roadmap issue #1: standalone replay artifact verifier plus optional ZK POC target notes.
- Phase 8 from roadmap issue #1: expansion ruleset slices for all-pay vote auction and non-transitive dice.
- Phase 9 from roadmap issue #1: regression replay fixtures, release report, compliance notes, and final packaging checks.

## IP and Compliance Boundary

- This project uses original naming, UI, and code.
- Design research under `audits/kakegurui_zk_game_design_pack/` is local reference material and must not be committed.
- The MVP uses virtual game resources only. Real-money gambling, redeemable tokens, prizes, or regulated betting flows are out of scope unless a separate legal/compliance review is completed.

## Setup

```bash
npm install
npm run dev
npm run simulate
npm run verify
npm run release:check
npm run check
```

## Verification

```bash
npm test
npm run build
```

`npm test` uses the project-local `.tmp/` directory for temporary files so the test suite is not blocked by a full system `/tmp` partition.

## Architecture

Phase 0 establishes reusable engine primitives:

- `src/engine/rng.ts`: seeded deterministic RNG with append-only `randomLog` records.
- `src/engine/stateMachine.ts`: generic ruleset, state, action, settlement, and audit interfaces.
- `src/engine/actionLog.ts`: append-only action records chained by stable hashes.
- `src/engine/commitments.ts`: canonical commit/reveal helpers for hidden choices.
- `src/engine/audit.ts`: fairness and anomaly report types.
- `src/engine/replay.ts`: replay envelopes and stable replay hashing.
- `src/gambles/catalog.ts`: catalog schema, validation, filtering, and runtime IP-safety checks.
- `src/gambles/catalogData.ts`: original runtime catalog distilled from local audit research.
- `src/gambles/ballotRps/`: first playable ruleset, NPC heuristic, typed actions, and deterministic demo runner.
- `src/gambles/zeroNim/`: second playable ruleset with betting, bust logic, NPC risk heuristics, and anomaly telemetry.
- `src/gambles/greaterGood/`: public-goods ruleset with contribution/vote commitments, distribution, elimination, and archetype heuristics.
- `src/gambles/allPayAuction/`: sealed-bid all-pay vote auction demo with commit/reveal bids.
- `src/gambles/nontransitiveDice/`: probability tutorial for counter-pick dice dominance cycles.
- `src/ai/`: shared NPC archetypes, difficulty policy, deterministic simulation summaries, and CLI simulation entrypoint.
- `src/verify/`: replay artifact export, hash/log/commitment verifier, and CLI verifier.
- `src/zk/proofTypes.ts`: optional ZK POC target metadata kept outside the normal runtime path.
- `src/release/`: release report generator and CLI checks.
- `fixtures/replays/manifest.json`: stable replay hashes for regression checks.
- `docs/release.md` and `docs/compliance.md`: release scope, known limitations, and virtual-game compliance boundary.
- `src/ui/GambleLab.tsx`: data-driven catalog browser for phase, complexity, readiness, and fairness priority.
- `src/ui/BallotRpsDemo.tsx`: UI surface for the first playable match; rules and settlement remain in the ruleset.
- `src/ui/ZeroNimDemo.tsx`: UI surface for the second playable match; betting and bust rules remain in the ruleset.
- `src/ui/GreaterGoodDemo.tsx`: UI surface for the public-goods match; contribution, voting, and settlement rules remain in the ruleset.
- `src/ui/SimulationPanel.tsx`: UI snapshot for deterministic balance metrics.
- `src/ui/VisualSlice.tsx`: native 2.5D visual frame for academy map, table, chip/card motion, and audit board.
- `src/ui/ExpansionDemo.tsx`: UI surface for Phase 8 auction and dice tutorial slices.

The React UI in `src/App.tsx` displays foundation demo state and catalog data. It does not implement settlement or game rules.

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

Next work should move from MVP scaffolding to hardening: full ruleset re-execution in the verifier, browser interaction tests, multiplayer room protocol, and deeper balance tuning.
