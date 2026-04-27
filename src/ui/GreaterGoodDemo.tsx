import { useState } from "react";
import { runGreaterGoodDemo } from "../gambles/greaterGood/demo";

export function GreaterGoodDemo() {
  const [seed, setSeed] = useState("greater-good-phase-4");
  const demo = runGreaterGoodDemo(seed);
  const result = demo.state.publicState.result;
  const audit = demo.state.publicState.audit;

  return (
    <section className="goodDemo" aria-labelledby="good-heading">
      <div className="labHeader">
        <div>
          <p className="eyebrow">Public Goods MVP</p>
          <h2 id="good-heading">Greater Good</h2>
          <p>
            Five players commit hidden contributions, reveal tax/personal splits, receive
            doubled common-pool returns, then commit and reveal elimination votes.
          </p>
        </div>
        <div className="metricCard">
          <strong>{demo.state.publicState.alivePlayers.length}</strong>
          <span>survivors</span>
        </div>
      </div>

      <div className="seedPanel compact">
        <label>
          Match seed
          <input value={seed} onChange={(event) => setSeed(event.target.value)} />
        </label>
        <div>
          <h3>Settlement</h3>
          <p>{result?.reason}</p>
        </div>
      </div>

      <div className="rpsGrid">
        <article className="panel">
          <h3>Balances</h3>
          <dl className="facts">
            {Object.entries(demo.state.publicState.balances).map(([playerId, balance]) => (
              <div key={playerId}>
                <dt>{playerId}</dt>
                <dd>{balance}</dd>
              </div>
            ))}
          </dl>
        </article>
        <article className="panel">
          <h3>Eliminated</h3>
          <p>{demo.state.publicState.eliminatedPlayers.join(", ") || "None"}</p>
          <p>Winner: {result?.winnerIds.join(", ")}</p>
        </article>
        <article className="panel">
          <h3>Fairness</h3>
          <dl className="facts">
            <div>
              <dt>Random log</dt>
              <dd>{String(audit?.fairness.randomVerified)}</dd>
            </div>
            <div>
              <dt>Commitments</dt>
              <dd>{String(audit?.fairness.commitmentsVerified)}</dd>
            </div>
            <div>
              <dt>Settlement</dt>
              <dd>{String(audit?.fairness.settlementVerified)}</dd>
            </div>
          </dl>
        </article>
        <article className="panel">
          <h3>Replay hash</h3>
          <p className="hash">{audit?.replayHash}</p>
        </article>
      </div>
    </section>
  );
}
