import { useState } from "react";
import { runAllPayAuctionDemo } from "../gambles/allPayAuction/demo";
import { runNontransitiveDiceDemo, type DieId } from "../gambles/nontransitiveDice/demo";

const dieOptions: DieId[] = ["ember", "granite", "tide"];

export function ExpansionDemo() {
  const [seed, setSeed] = useState("phase-8-expansion");
  const [die, setDie] = useState<DieId>("ember");
  const auction = runAllPayAuctionDemo(seed);
  const dice = runNontransitiveDiceDemo(seed, die);

  return (
    <section className="expansionDemo" aria-labelledby="expansion-heading">
      <div className="labHeader">
        <div>
          <p className="eyebrow">Expansion Pack</p>
          <h2 id="expansion-heading">Auction and probability tutorials</h2>
          <p>
            Phase 8 adds two compact, replayable rules slices: all-pay sealed auction
            and non-transitive dice counter-picking.
          </p>
        </div>
        <div className="metricCard">
          <strong>2</strong>
          <span>new rulesets</span>
        </div>
      </div>

      <div className="seedPanel compact">
        <label>
          Expansion seed
          <input value={seed} onChange={(event) => setSeed(event.target.value)} />
        </label>
        <label>
          Player die
          <select value={die} onChange={(event) => setDie(event.target.value as DieId)}>
            {dieOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rpsGrid">
        <article className="panel">
          <h3>All-pay vote auction</h3>
          <p>{auction.settlement.reason}</p>
          <dl className="facts">
            {Object.entries(auction.revealedBids).map(([playerId, bid]) => (
              <div key={playerId}>
                <dt>{playerId}</dt>
                <dd>{bid}</dd>
              </div>
            ))}
          </dl>
        </article>
        <article className="panel">
          <h3>Non-transitive dice</h3>
          <p>{dice.lesson}</p>
          <p>
            Player {dice.playerWins} / Dealer {dice.dealerWins}
          </p>
        </article>
      </div>
    </section>
  );
}
