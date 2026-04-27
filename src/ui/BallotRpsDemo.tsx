import { useState } from "react";
import { runBallotRpsDemo } from "../gambles/ballotRps/demo";
import type { RpsMove } from "../gambles/ballotRps/types";

const moves: RpsMove[] = ["rock", "paper", "scissors"];

export function BallotRpsDemo() {
  const [seed, setSeed] = useState("ballot-rps-phase-2");
  const [requestedMove, setRequestedMove] = useState<RpsMove>("paper");
  const demo = runBallotRpsDemo(seed, requestedMove);
  const result = demo.state.publicState.result;
  const audit = demo.state.publicState.audit;

  return (
    <section className="rpsDemo" aria-labelledby="rps-heading">
      <div className="labHeader">
        <div>
          <p className="eyebrow">Playable MVP</p>
          <h2 id="rps-heading">Ballot RPS</h2>
          <p>
            A complete seeded match: voter commitments shape the card pool, both duelists
            commit hidden plays, reveals are verified, and settlement is replay-audited.
          </p>
        </div>
        <div className="metricCard">
          <strong>{demo.state.actionLog.length}</strong>
          <span>logged actions</span>
        </div>
      </div>

      <div className="seedPanel compact">
        <label>
          Match seed
          <input value={seed} onChange={(event) => setSeed(event.target.value)} />
        </label>
        <label>
          Preferred play
          <select value={requestedMove} onChange={(event) => setRequestedMove(event.target.value as RpsMove)}>
            {moves.map((move) => (
              <option key={move} value={move}>
                {move}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rpsGrid">
        <article className="panel">
          <h3>Your hand</h3>
          <div className="moveCards">
            {demo.humanHand.map((move, index) => (
              <span className={move === demo.humanMove ? "moveCard selected" : "moveCard"} key={`${move}-${index}`}>
                {move}
              </span>
            ))}
          </div>
        </article>
        <article className="panel">
          <h3>NPC reveal</h3>
          <div className="moveCards">
            {demo.npcHand.map((move, index) => (
              <span className={move === demo.npcMove ? "moveCard selected" : "moveCard"} key={`${move}-${index}`}>
                {move}
              </span>
            ))}
          </div>
        </article>
        <article className="panel">
          <h3>Settlement</h3>
          <p>{result?.reason ?? "Not settled"}</p>
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
      </div>
    </section>
  );
}
