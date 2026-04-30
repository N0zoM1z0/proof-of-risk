# Optional ZK POC

Phase 16 adds a runnable optional Circom/snarkjs proof-of-constraints POC for `greater-good-contribution`.
The normal app remains independent from ZK tooling: `npm install`, `npm test`, `npm run build`, and
`npm run check` do not require Circom, snarkjs, or a trusted setup.

## Run

```bash
npm run zk:poc
npm run zk:prove
```

The `zk:poc` script:

- Checks whether `circom` and `snarkjs` are installed.
- Gracefully skips with a JSON reason if the optional toolchain is missing.
- Compiles `zk/circom/greater_good_contribution.circom`.
- Generates a witness from `zk/inputs/greater_good_contribution.valid.json`.
- Runs `snarkjs wtns check` against the generated R1CS and witness.
- Writes generated files under `.tmp/zk-poc/`.

The `zk:prove` script extends the same POC into a local Groth16 prove/verify flow:

- Checks whether `circom` and `snarkjs` are installed.
- Gracefully skips with a JSON reason if the optional toolchain is missing.
- Compiles the same circuit and generates the same witness.
- Runs a local powers-of-tau phase for this development POC.
- Generates proving key, verification key, proof, and public signals under `.tmp/zk-prove/`.
- Runs `snarkjs groth16 verify` against the generated verification key, public signals, and proof.

## Circuit Scope

Public inputs:

- `coinsPerRound`
- `sumTax`
- `alivePlayerCount`
- `publicReturn`
- `returnRemainder`
- `commitment`

Private witness:

- `tax`
- `personal`
- `salt`

Constraints:

- `tax` and `personal` are integers in `[0, 5]`.
- `coinsPerRound = 5`.
- `alivePlayerCount = 5`.
- `tax + personal = coinsPerRound`.
- `publicReturn * alivePlayerCount = sumTax * 2 + returnRemainder`.
- `returnRemainder` is in `[0, 4]`.
- `commitment = tax + personal * 10 + salt * 100`.

## Limitations

The commitment is intentionally a demo algebraic commitment so the first POC is small and dependency-free.
It is not a cryptographic hash and must not be used as a production privacy primitive. The `zk:prove`
workflow is a local development proving flow, not a production ceremony. A production circuit should replace
the commitment with a field-friendly hash, cover full game state transitions, and use an audited setup process.
