# Release Notes

## Release Scope

This repository currently delivers:

- Deterministic engine primitives for seeded randomness, hash-chained action logs, commitments, audit reporting, and replay hashing.
- A React demo client with a stylized academy-themed presentation and playable local ruleset surfaces.
- Playable strategy rulesets for Ballot RPS, Zero Nim, Greater Good, All-pay Vote Auction, and Non-transitive Dice.
- Deterministic NPC archetypes, simulation utilities, replay artifact generation, and standalone verification tooling.
- A local/dev standalone HTTP server with room lifecycle APIs, bearer-session issuance, rankings, and viewer-aware snapshots.
- A WebSocket room protocol for subscription, action acknowledgement, and synchronized snapshot broadcast.
- Local persistence primitives for profiles, accounts, sessions, matches, artifacts, rankings, and JSON-backed app storage.
- Optional Circom/snarkjs research flows for a Greater Good contribution proof-of-constraints and local Groth16 prove/verify run.

## Release Checks

Run:

```bash
npm test
npm run build
npm run test:e2e
npm run load:test
npm run simulate
npm run verify
npm run release:check
```

Or run the standard aggregate gate:

```bash
npm run check
```

## Current Limitations

- The browser UI is still primarily a local demo surface and is not yet wired as a full network client to the standalone server.
- Runtime room state remains process-local and is not designed for multi-node recovery or horizontal scaling.
- The JSON-backed app database is appropriate for local development and research, not for production data durability requirements.
- Session and account handling remain development-oriented and do not yet include hardened revocation, rotation, rate limiting, or abuse controls.
- The optional ZK circuit uses a demo-friendly commitment model and covers a narrow proof slice rather than complete state transition validity.
