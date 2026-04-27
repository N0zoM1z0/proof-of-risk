# Optional ZK POC Notes

Phase 7 keeps the normal app independent from ZK tooling. The committed deliverable is the standalone verifier for replay artifacts.

The first optional proof target is `greater-good-contribution`:

- Public inputs: `gameId`, `round`, `commitmentRoot`, `sumTax`, `publicReturn`, `alivePlayerCount`.
- Private witness: `tax_i`, `personal_i`, `salt_i`.
- Constraints: contribution range, `tax + personal = 5`, commitment correctness, and public return calculation.

The ZK toolchain is intentionally unselected in this phase. Circom/snarkjs or Noir can be added later without blocking `npm install`, `npm test`, or `npm run build`.
