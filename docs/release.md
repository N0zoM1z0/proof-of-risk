# Release Notes

## Current MVP Scope

- Deterministic engine foundation with seeded random logs, action logs, commitments, audit reports, and replay hashing.
- Runtime-safe gamble catalog and Gamble Lab.
- Playable deterministic slices: Ballot RPS, Zero Nim, Greater Good, All-pay Vote Auction, and Non-transitive Dice.
- Shared NPC archetypes, difficulty policies, deterministic simulation metrics, replay artifact verifier, and genesis replay verifier.
- 2.5D CSS/React visual slice with academy map, perspective table, motion, reduced-motion support, and smoke tests.

## Release Checks

Run:

```bash
npm test
npm run build
npm run test:e2e
npm run simulate
npm run verify
npm run release:check
```

## Known Limitations

- Browser interaction coverage is still smoke-level and should be expanded with Playwright.
- ZK proof tooling is documented as optional and is not required for normal development.
- Multiplayer networking, persistence, accounts, room sync, rankings, and anti-sybil systems remain out of scope for this MVP.
