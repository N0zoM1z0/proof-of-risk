import { useState } from "react";
import { buildFoundationDemo } from "./demo";
import { BallotRpsDemo } from "./ui/BallotRpsDemo";
import { GambleLab } from "./ui/GambleLab";

export default function App() {
  const [seed, setSeed] = useState("academy-gambit-phase-0");
  const demo = buildFoundationDemo(seed);

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Proof of Risk: Academy Gambit</p>
        <h1>Deterministic engine foundation</h1>
        <p>
          Phase 0 proves the base loop: seeded randomness, append-only actions,
          commit/reveal verification, audit flags, and replay hashing.
        </p>
      </section>

      <section className="panel seedPanel" aria-labelledby="seed-heading">
        <div>
          <h2 id="seed-heading">Replay seed</h2>
          <p>Change the seed to verify that replay artifacts change deterministically.</p>
        </div>
        <input
          value={seed}
          onChange={(event) => setSeed(event.target.value)}
          aria-label="Replay seed"
        />
      </section>

      <section className="grid">
        <article className="panel">
          <h2>Audit verdict</h2>
          <dl className="facts">
            <div>
              <dt>Randomness</dt>
              <dd>{String(demo.audit.fairness.randomVerified)}</dd>
            </div>
            <div>
              <dt>Commitment</dt>
              <dd>{demo.commitment.status}</dd>
            </div>
            <div>
              <dt>Replay hash</dt>
              <dd className="hash">{demo.replayHash}</dd>
            </div>
          </dl>
        </article>

        <article className="panel">
          <h2>Deterministic draw</h2>
          <ol className="drawList">
            {demo.draw.map((card) => (
              <li key={card}>{card}</li>
            ))}
          </ol>
        </article>

        <article className="panel wide">
          <h2>Random log</h2>
          <pre>{JSON.stringify(demo.randomLog, null, 2)}</pre>
        </article>

        <article className="panel wide">
          <h2>Action log</h2>
          <pre>{JSON.stringify(demo.actionLog, null, 2)}</pre>
        </article>
      </section>

      <BallotRpsDemo />
      <GambleLab />
    </main>
  );
}
