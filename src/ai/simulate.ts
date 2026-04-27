import { runDeterministicSimulations } from "./simulations.ts";

const summary = runDeterministicSimulations({
  seedPrefix: "cli",
  iterations: 8,
  difficulty: "hard",
  archetypeId: "analyst"
});

console.log(JSON.stringify(summary, null, 2));
