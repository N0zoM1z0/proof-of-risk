# Release Notes

## Current MVP Scope

- Deterministic engine foundation with seeded random logs, action logs, commitments, audit reports, and replay hashing.
- Runtime-safe gamble catalog and Gamble Lab.
- Playable deterministic slices: Ballot RPS, Zero Nim, Greater Good, All-pay Vote Auction, and Non-transitive Dice.
- Shared NPC archetypes, difficulty policies, deterministic simulation metrics, and replay artifact verifier.
- 2.5D CSS/React visual slice with academy map, perspective table, motion, reduced-motion support, and smoke tests.

## Release Checks

Run:

```bash
npm test
npm run build
npm run simulate
npm run verify
npm run release:check
```

## Known Limitations

- Multiplayer networking, accounts, persistence, and anti-sybil systems are not implemented.
- Verifier checks exported artifact integrity; it does not yet re-execute each ruleset from genesis.
- ZK proof tooling is documented as optional and is not required for normal development.
- Expansion rulesets are compact deterministic slices, not full production state machines.
