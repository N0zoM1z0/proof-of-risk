import { appendAction } from "./engine/actionLog";
import { createAuditReport } from "./engine/audit";
import { createCommitmentRecord, revealCommitment } from "./engine/commitments";
import { DeterministicRng } from "./engine/rng";
import { createReplayEnvelope, computeReplayHash } from "./engine/replay";

export function buildFoundationDemo(seed: string) {
  const gameId = "foundation-demo";
  const rulesetId = "foundation.v0";
  const rng = new DeterministicRng(seed);
  const draw = rng.shuffle(["audit", "risk", "proof"], "demo.draw");
  const firstAction = appendAction([], {
    gameId,
    playerId: "player:auditor",
    type: "DEMO_DRAW",
    payload: { draw },
    turn: 0
  });
  const commitment = createCommitmentRecord({
    gameId,
    round: 1,
    playerId: "player:auditor",
    choice: { card: draw[0] },
    salt: "phase-0-demo-salt",
    createdAtTurn: 1
  });
  const revealed = revealCommitment(
    commitment,
    { card: draw[0] },
    "phase-0-demo-salt",
    2
  );
  const replayEnvelope = createReplayEnvelope({
    gameId,
    rulesetId,
    seed,
    actionLog: [firstAction],
    randomLog: rng.randomLog,
    commitments: [revealed]
  });
  const replayHash = computeReplayHash(replayEnvelope);
  const audit = createAuditReport({
    fairness: {
      randomVerified: true,
      commitmentsVerified: revealed.status === "revealed",
      settlementVerified: true
    },
    anomalies: [],
    replayHash
  });

  return {
    seed,
    draw,
    actionLog: [firstAction],
    randomLog: [...rng.randomLog],
    commitment: revealed,
    replayHash,
    audit
  };
}
