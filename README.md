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
- Phase 10 from roadmap issue #2: project-local test temp isolation and one-command release check.
- Phase 11 from roadmap issue #2: verifier genesis replay for formal MVP rulesets.
- Phase 12 from roadmap issue #2: formal expansion rulesets for all-pay auction and non-transitive dice.
- Phase 13 from roadmap issue #2: Playwright production-preview browser interaction tests.
- Phase 14 from roadmap issue #2: local in-memory multiplayer room protocol for routed ruleset actions.
- Phase 15 from roadmap issue #2: storage, profile, deterministic ranking, and placeholder anti-Sybil primitives.
- Phase 16 from roadmap issue #2: optional Circom/snarkjs Greater Good contribution ZK POC.
- Phase 17 from roadmap issue #3: standalone HTTP server API for health, sessions, rooms, actions, snapshots, and rankings.
- Phase 18 from roadmap issue #3: WebSocket room protocol for subscriptions, command acknowledgements, and multi-client snapshot broadcasts.
- Phase 19 from roadmap issue #3: versioned app database schema plus account/session records and session-gated mutating APIs.

## IP and Compliance Boundary

- This project uses original naming, UI, and code.
- Design research under `audits/kakegurui_zk_game_design_pack/` is local reference material and must not be committed.
- The MVP uses virtual game resources only. Real-money gambling, redeemable tokens, prizes, or regulated betting flows are out of scope unless a separate legal/compliance review is completed.

## Setup

```bash
npm install
npx playwright install chromium
npm run dev
npm run server
npm run simulate
npm run verify
npm run release:check
npm run check
npm run zk:poc
```

## Verification

```bash
npm test
npm run build
npm run test:e2e
```

`npm test` uses the project-local `.tmp/` directory for temporary files so the test suite is not blocked by a full system `/tmp` partition.
`npm run test:e2e` starts a Vite preview server and runs Playwright Chromium checks against the production build; run `npx playwright install chromium` once on a new machine.

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
- `src/gambles/allPayAuction/`: sealed-bid all-pay vote auction ruleset with commit/reveal bids and all-pay settlement.
- `src/gambles/nontransitiveDice/`: formal probability ruleset for counter-pick dice dominance cycles and deterministic rolls.
- `src/ai/`: shared NPC archetypes, difficulty policy, deterministic simulation summaries, and CLI simulation entrypoint.
- `src/multiplayer/rooms.ts`: in-memory room create/join/leave/submit/snapshot protocol for local multiplayer flows.
- `src/persistence/`: storage abstractions, versioned app database, memory/JSON implementations, ranking derivation, and anti-Sybil placeholder signals.
- `src/server/`: standalone Node HTTP API server with stable JSON response envelopes for local/dev multiplayer integration.
- `src/server/ws.ts`: WebSocket room sync protocol layered onto the HTTP server at `/ws`.
- `src/verify/`: replay artifact export, hash/log/commitment verifier, genesis replay verifier, and CLI verifier.
- `src/zk/`: optional ZK POC target metadata and fallback witness constraint checks kept outside the normal runtime path.
- `zk/circom/`: optional Circom POC circuit for Greater Good contribution constraints.
- `src/release/`: release report generator and CLI checks.
- `fixtures/replays/manifest.json`: stable replay hashes for regression checks.
- `docs/release.md` and `docs/compliance.md`: release scope, known limitations, and virtual-game compliance boundary.
- `src/ui/GambleLab.tsx`: data-driven catalog browser for phase, complexity, readiness, and fairness priority.
- `src/ui/BallotRpsDemo.tsx`: UI surface for the first playable match; rules and settlement remain in the ruleset.
- `src/ui/ZeroNimDemo.tsx`: UI surface for the second playable match; betting and bust rules remain in the ruleset.
- `src/ui/GreaterGoodDemo.tsx`: UI surface for the public-goods match; contribution, voting, and settlement rules remain in the ruleset.
- `src/ui/SimulationPanel.tsx`: UI snapshot for deterministic balance metrics.
- `src/ui/VisualSlice.tsx`: native 2.5D visual frame for academy map, table, chip/card motion, and audit board.
- `src/ui/ExpansionDemo.tsx`: UI surface for the auction and dice expansion rulesets.

The React UI in `src/App.tsx` displays foundation demo state and catalog data. It does not implement settlement or game rules.

## Determinism Contract

- Same seed plus same logged events must produce the same replay hash.
- Different seed or action order must produce a different replay hash.
- All random operations must be made through `DeterministicRng`.
- Hidden choices should be represented as commitments until their reveal or proof phase.

## Known Issues

- The Phase 0 hash and RNG stack is development-grade. Later phases should add stronger domain separation and independent verifier fixtures.
- ZK circuits are intentionally out of the Phase 0 critical path.

## Next Interfaces

Next work should move from MVP scaffolding to transport-level multiplayer, production ZK commitment design, and deeper balance tuning.
