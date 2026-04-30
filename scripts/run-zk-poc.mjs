import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const outDir = join(root, ".tmp", "zk-poc");
const circuit = join(root, "zk", "circom", "greater_good_contribution.circom");
const input = join(root, "zk", "inputs", "greater_good_contribution.valid.json");
const r1cs = join(outDir, "greater_good_contribution.r1cs");
const wasm = join(outDir, "greater_good_contribution_js", "greater_good_contribution.wasm");
const witnessGenerator = join(outDir, "greater_good_contribution_js", "generate_witness.js");
const witness = join(outDir, "greater_good_contribution.wtns");

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

console.log(
  JSON.stringify(
    {
      ok: true,
      skipped: false,
      target: "greater-good-contribution",
      toolchain: "circom-snarkjs",
      circuit,
      input,
      artifacts: {
        r1cs,
        wasm,
        witness
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
    console.error(`ZK POC failed during ${label}.`);
    if (result.stdout) {
      console.error(result.stdout);
    }
    if (result.stderr) {
      console.error(result.stderr);
    }
    process.exit(result.status ?? 1);
  }
}
