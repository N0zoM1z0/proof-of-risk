# Optional ZK Research Flow

This repository includes an optional Circom/snarkjs proof-of-constraints workflow for `greater-good-contribution`.
The main application does not depend on the ZK toolchain: `npm install`, `npm test`, `npm run build`, and
`npm run check` do not require `circom`, `snarkjs`, or a trusted setup ceremony.

## Run

```bash
npm run zk:poc
npm run zk:prove
```

The scripts:

- Detect whether `circom` and `snarkjs` are installed.
- Gracefully skip with a machine-readable JSON result when the optional toolchain is missing.
- Compile `zk/circom/greater_good_contribution.circom`.
- Generate a witness from `zk/inputs/greater_good_contribution.valid.json`.
- Validate the witness against the generated R1CS.
- Write generated artifacts into `.tmp/zk-poc/` or `.tmp/zk-prove/`.

The `zk:prove` flow additionally:

- Runs a local powers-of-tau setup for development use.
- Generates proving and verification keys.
- Produces a proof and public signals.
- Executes local Groth16 verification against the generated proof artifacts.

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

The commitment is intentionally a small demo algebraic commitment so the research flow stays lightweight.
It is not a cryptographic hash and must not be treated as a production privacy primitive.

The `zk:prove` workflow is a local development proving path, not a production ceremony.
A production-ready circuit would need:

- A field-friendly cryptographic commitment or hash.
- Coverage of full game-state transitions instead of a single contribution slice.
- An audited setup process and stronger operational controls around proof generation.
