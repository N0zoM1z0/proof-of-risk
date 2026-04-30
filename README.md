# Proof of Risk

`Proof of Risk: Academy Gambit` is a deterministic strategy-game prototype focused on replayable fairness, inspectable game state, and verifiable risk mechanics. The repository combines a React demo client, a standalone Node server, deterministic rulesets, replay verification, and an optional zero-knowledge proving research path.

## Product Overview

Proof of Risk is built around three product ideas:

- Every meaningful game event should be reproducible from a seed, an action log, and a ruleset.
- Hidden information should move through explicit commit/reveal or proof-oriented flows instead of opaque state changes.
- Fairness claims should be inspectable through artifacts, verifier tooling, and deterministic replay.

The current product surface includes:

- A browser client with playable demos and a stylized academy-themed presentation.
- A deterministic engine for random draws, action logs, commitments, settlements, and replay hashing.
- Multiple strategy-game rulesets with typed actions and deterministic NPC behavior.
- A standalone HTTP and WebSocket server for room-based multiplayer experiments.
- Local persistence primitives for profiles, sessions, matches, replay artifacts, and rankings.
- Verification tooling for artifact integrity, genesis replay, regression fixtures, and release checks.
- An optional Circom/snarkjs proof-of-constraints workflow for research on private contribution proofs.

## Feature Set

### Playable Rulesets

- `Ballot RPS`: committed votes, hidden play commit/reveal, deterministic NPC selection, and replayable settlement.
- `Zero Nim`: betting, bust thresholds, hidden card commit/reveal, and anomaly-oriented audit signals.
- `Greater Good`: public-goods contributions, elimination voting, common-pool redistribution, and archetype-driven NPCs.
- `All-pay Vote Auction`: sealed all-pay bidding with reveal and deterministic settlement.
- `Non-transitive Dice`: counter-pick probability game with deterministic roll logging.

### Runtime and Verification

- Seeded RNG with append-only random logs.
- Hash-chained action logs and stable replay hashing.
- Canonical commit/reveal helpers for hidden choices.
- Artifact export and standalone verifier CLI.
- Genesis replay verification for supported formal rulesets.
- Regression replay manifest for release consistency.

### Multiplayer and Persistence

- Room create/join/action/snapshot flows.
- JSON-over-HTTP API with stable success and failure envelopes.
- WebSocket subscription and snapshot broadcast protocol at `/ws`.
- Local account/session issuance for authenticated mutating actions.
- Local persistence adapters for players, matches, artifacts, accounts, sessions, and rankings.

## Repository Layout

- `src/engine/`: deterministic runtime primitives for RNG, action logs, commitments, audit data, and replay hashing.
- `src/gambles/`: rulesets, demos, and AI heuristics for the supported game modes.
- `src/ui/`: React UI surfaces for playable demos, room flow, simulation summaries, and catalog browsing.
- `src/multiplayer/`: room lifecycle and routed action handling.
- `src/server/`: standalone HTTP server, WebSocket room sync, and load harness.
- `src/persistence/`: storage abstractions, ranking derivation, session records, and JSON-backed local persistence.
- `src/verify/`: replay artifact generation and verifier entrypoints.
- `src/ai/`: deterministic simulation and NPC archetype utilities.
- `src/release/`: release report and consistency checks.
- `src/zk/` and `zk/`: optional ZK research helpers, circuit, and inputs.
- `tests/`: unit, integration, protocol, persistence, verifier, and Playwright coverage.
- `docs/`: release, compliance, and ZK research notes.

## Quick Start

### Requirements

- Node.js 20+ recommended
- npm
- Chromium for Playwright: `npx playwright install chromium`
- Optional for ZK research: `circom` and `snarkjs`

### Install

```bash
npm install
npx playwright install chromium
```

### Run the Frontend

```bash
npm run dev
```

### Run the Server

```bash
npm run server
```

By default the server uses in-memory room state and in-memory account/session storage.
To persist app data locally:

```bash
PROOF_DB_FILE=.tmp/app-db.json npm run server
```

## Operational Commands

```bash
npm test
npm run build
npm run test:e2e
npm run load:test
npm run simulate
npm run verify
npm run release:check
npm run check
npm run zk:poc
npm run zk:prove
```

What they do:

- `npm test`: Vitest suite with project-local temp isolation under `.tmp/`.
- `npm run test:e2e`: Playwright browser interaction coverage against a production preview build.
- `npm run load:test`: bounded HTTP and WebSocket protocol exercise against a real in-process server.
- `npm run simulate`: deterministic AI and balance-oriented simulation summaries.
- `npm run verify`: artifact integrity and replay verification.
- `npm run release:check`: release report and regression consistency checks.
- `npm run check`: full default validation pipeline.
- `npm run zk:poc` and `npm run zk:prove`: optional ZK research flows that gracefully skip if toolchains are unavailable.

## Server API

The standalone server exposes a local/dev JSON API:

- `GET /health`
- `POST /sessions`
- `POST /rooms`
- `POST /rooms/:id/join`
- `POST /rooms/:id/actions`
- `GET /rooms/:id?viewer=PLAYER_ID`
- `GET /rankings`

Behavior notes:

- Responses use stable `ok: true` or `ok: false` envelopes.
- `POST /sessions` returns a bearer token and expiry timestamp.
- Mutating room endpoints require `Authorization: Bearer <token>`.
- `GET /rooms/:id` supports viewer-aware snapshots.
- Rankings are derived from locally stored match data.

The WebSocket protocol is available at `/ws` and supports:

- `subscribe`
- `action`
- `ping`

Server messages include:

- `subscribed`
- `snapshot`
- `ack`
- `pong`
- `error`

## Architecture Notes

The determinism contract is central to the repository:

- The same seed and equivalent action history must produce the same replay hash.
- Changes in seed or action order must change the replay output.
- Randomness is routed through the deterministic RNG and logged.
- Hidden choices remain committed until reveal or proof time.

This contract is what allows the verifier, regression fixtures, and replay tooling to act as product features instead of debug-only utilities.

## Validation Status

The repository currently ships with:

- Unit and integration coverage for engine, rulesets, persistence, verifier flows, and server protocol behavior.
- Browser interaction coverage for the main demo flow and error paths.
- Local load testing for concurrent room/session/WebSocket behavior.
- Optional local Groth16 prove/verify execution for the research circuit.

The default end-to-end quality gate is:

```bash
npm run check
```

## Current Product Boundaries

This repository is a strong prototype and productization base, not a finished production service.

Current boundaries include:

- The React UI does not yet act as a full network client for the HTTP and WebSocket server.
- Room runtime state is process-local and not designed for clustered deployment.
- The JSON database is a local persistence mechanism, not a production relational backend.
- Session handling is suitable for local/dev flows but does not yet include hardened revocation, rotation, or abuse controls.
- The ZK workflow proves a narrow contribution constraint slice, not full game-state transition validity.

## Compliance Boundary

- This project uses original names, UI, and code.
- `audits/kakegurui_zk_game_design_pack/` is local design research material and must not be committed.
- The product is scoped to virtual gameplay only.
- Real-money gambling, redeemable rewards, custodial value flows, and regulated betting features are out of scope without separate legal and compliance review.

Additional detail lives in [docs/compliance.md](docs/compliance.md).

## Additional Documentation

- [docs/release.md](docs/release.md)
- [docs/zk-poc.md](docs/zk-poc.md)
