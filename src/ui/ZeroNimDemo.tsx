import { useState } from "react";
import { runZeroNimDemo } from "../gambles/zeroNim/demo";
import type { NimCard } from "../gambles/zeroNim/types";

const cards: NimCard[] = [0, 1, 2, 3];

export function ZeroNimDemo() {
  const [seed, setSeed] = useState("zero-nim-phase-3");
  const [preferredCard, setPreferredCard] = useState<NimCard>(3);
  const demo = runZeroNimDemo(seed, preferredCard);
  const result = demo.state.publicState.result;
  const audit = demo.state.publicState.audit;

  return (
    <section className="nimDemo" aria-labelledby="nim-heading">
      <div className="labHeader">
        <div>
          <p className="eyebrow">Strategy MVP</p>
          <h2 id="nim-heading">Zero Nim</h2>
          <p>
            Sequential 0-3 card Nim with a betting gate, hidden card commitment,
            bust threshold, risk-aware NPC decisions, and audit-only anomaly signals.
          </p>
        </div>
        <div className="metricCard">
          <strong>{demo.state.publicState.total}</strong>
          <span>final total / {demo.state.publicState.threshold}</span>
        </div>
      </div>

      <div className="seedPanel compact">
        <label>
          Match seed
          <input value={seed} onChange={(event) => setSeed(event.target.value)} />
        </label>
        <label>
          Preferred card
          <select
            value={preferredCard}
            onChange={(event) => setPreferredCard(Number(event.target.value) as NimCard)}
          >
            {cards.map((card) => (
              <option key={card} value={card}>
                {card}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rpsGrid">
        <article className="panel">
          <h3>Settlement</h3>
          <p>{result?.reason ?? "Not settled"}</p>
          <p>Winner: {result?.winnerIds.join(", ")}</p>
          <p>Pot: {demo.state.publicState.pot}</p>
        </article>
        <article className="panel">
          <h3>Last reveal</h3>
          <p>
            {demo.state.publicState.lastRevealed?.playerId} played{" "}
            {demo.state.publicState.lastRevealed?.card}
          </p>
          <p className="hash">{audit?.replayHash}</p>
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
          <h3>Audit flags</h3>
          {audit?.anomalies.length ? (
            <ul className="catalogBullets">
              {audit.anomalies.map((anomaly) => (
                <li key={anomaly.signal}>{anomaly.explanation}</li>
              ))}
            </ul>
          ) : (
            <p>No anomaly flags.</p>
          )}
        </article>
      </div>
    </section>
  );
}
