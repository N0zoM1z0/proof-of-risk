import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const outDir = join(root, ".tmp", "zk-prove");
const circuit = join(root, "zk", "circom", "greater_good_contribution.circom");
const input = join(root, "zk", "inputs", "greater_good_contribution.valid.json");
const r1cs = join(outDir, "greater_good_contribution.r1cs");
const wasm = join(outDir, "greater_good_contribution_js", "greater_good_contribution.wasm");
const witnessGenerator = join(outDir, "greater_good_contribution_js", "generate_witness.js");
const witness = join(outDir, "greater_good_contribution.wtns");
const pot0 = join(outDir, "pot8_0000.ptau");
const pot1 = join(outDir, "pot8_0001.ptau");
const potFinal = join(outDir, "pot8_final.ptau");
const zkey0 = join(outDir, "greater_good_contribution_0000.zkey");
const zkeyFinal = join(outDir, "greater_good_contribution_final.zkey");
const verificationKey = join(outDir, "verification_key.json");
const proof = join(outDir, "proof.json");
const publicSignals = join(outDir, "public.json");

const circom = findCommand("circom");
const snarkjs = findCommand("snarkjs");

if (!circom || !snarkjs) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        skipped: true,
        reason: "Optional Circom/snarkjs toolchain is not installed.",
        target: "greater-good-contribution"
      },
      null,
      2
    )
  );
  process.exit(0);
}

mkdirSync(outDir, { recursive: true });
run(circom, [circuit, "--r1cs", "--wasm", "--sym", "-o", outDir], "compile circuit");
writeFileSync(join(outDir, "greater_good_contribution_js", "package.json"), "{\"type\":\"commonjs\"}\n", "utf8");
run(process.execPath, [witnessGenerator, wasm, input, witness], "generate witness");
run(snarkjs, ["wtns", "check", r1cs, witness], "check witness constraints");
run(snarkjs, ["powersoftau", "new", "bn128", "8", pot0, "-v"], "start powers of tau");
run(snarkjs, ["powersoftau", "contribute", pot0, pot1, "--name=proof-of-risk phase23", "-v", "-e=phase23"], "contribute powers of tau");
run(snarkjs, ["powersoftau", "prepare", "phase2", pot1, potFinal, "-v"], "prepare phase2");
run(snarkjs, ["groth16", "setup", r1cs, potFinal, zkey0], "groth16 setup");
run(snarkjs, ["zkey", "contribute", zkey0, zkeyFinal, "--name=proof-of-risk phase23", "-v", "-e=phase23-zkey"], "zkey contribution");
run(snarkjs, ["zkey", "export", "verificationkey", zkeyFinal, verificationKey], "export verification key");
run(snarkjs, ["groth16", "prove", zkeyFinal, witness, proof, publicSignals], "generate proof");
run(snarkjs, ["groth16", "verify", verificationKey, publicSignals, proof], "verify proof");

console.log(
  JSON.stringify(
    {
      ok: true,
      skipped: false,
      target: "greater-good-contribution",
      toolchain: "circom-snarkjs-groth16",
      circuit,
      input,
      artifacts: {
        r1cs,
        witness,
        provingKey: zkeyFinal,
        verificationKey,
        proof,
        publicSignals
      }
    },
    null,
    2
  )
);

function findCommand(command) {
  const found = spawnSync("bash", ["-lc", `command -v ${command}`], { encoding: "utf8" });
  return found.status === 0 ? found.stdout.trim() : "";
}

function run(command, args, label) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.status !== 0) {
    console.error(`ZK prove workflow failed during ${label}.`);
    if (result.stdout) {
      console.error(result.stdout);
    }
    if (result.stderr) {
      console.error(result.stderr);
    }
    process.exit(result.status ?? 1);
  }
}
