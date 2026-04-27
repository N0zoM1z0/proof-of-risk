import { runDeterministicSimulations } from "../ai/simulations";

export function SimulationPanel() {
  const summary = runDeterministicSimulations({
    seedPrefix: "ui",
    iterations: 6,
    difficulty: "hard",
    archetypeId: "analyst"
  });

  return (
    <section className="simPanel" aria-labelledby="sim-heading">
      <div className="labHeader">
        <div>
          <p className="eyebrow">AI Balance</p>
          <h2 id="sim-heading">Deterministic simulation snapshot</h2>
          <p>
            Shared NPC policy and difficulty settings now produce stable metrics across
            implemented games. This is the first balance loop for later tuning.
          </p>
        </div>
        <div className="metricCard">
          <strong>{summary.iterations}</strong>
          <span>seeded runs</span>
        </div>
      </div>
      <div className="rpsGrid">
        <article className="panel">
          <h3>Policy</h3>
          <p>
            {summary.archetypeId} / {summary.difficulty}
          </p>
        </article>
        <article className="panel">
          <h3>Win and bust rates</h3>
          <p>Ballot RPS player win rate: {summary.ballotRpsPlayerWinRate}</p>
          <p>Zero Nim bust rate: {summary.zeroNimBustRate}</p>
        </article>
        <article className="panel">
          <h3>Public-goods metrics</h3>
          <p>Average eliminations: {summary.greaterGoodAverageEliminations}</p>
          <p>Average winner balance: {summary.greaterGoodAverageWinnerBalance}</p>
        </article>
        <article className="panel">
          <h3>Audit flags</h3>
          <p>Flag rate per run: {summary.auditFlagRate}</p>
        </article>
      </div>
    </section>
  );
}
