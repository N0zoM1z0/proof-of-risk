const rooms = [
  { id: "mirror-hall", label: "Mirror Hall", status: "Ballot RPS live" },
  { id: "ledger-room", label: "Ledger Room", status: "Zero Nim pressure table" },
  { id: "commons", label: "Commons", status: "Greater Good vote audit" },
  { id: "tower", label: "North Tower", status: "Locked for Phase 8" }
];

export function VisualSlice() {
  return (
    <section className="visualSlice" aria-labelledby="visual-heading">
      <div className="visualCopy">
        <p className="eyebrow">2.5D Vertical Slice</p>
        <h2 id="visual-heading">Academy risk floor</h2>
        <p>
          The app now has a native visual frame for the academy map, perspective table,
          card/chip motion, NPC pressure, and audit evidence. It remains a rendering
          layer only: game rules stay in deterministic rulesets.
        </p>
      </div>

      <div className="visualGrid">
        <nav className="academyMap" aria-label="Academy rooms">
          {rooms.map((room) => (
            <button className="roomNode" key={room.id} type="button">
              <strong>{room.label}</strong>
              <span>{room.status}</span>
            </button>
          ))}
        </nav>

        <div className="tableStage" aria-label="Perspective risk table">
          <div className="riskTable">
            <span className="tableCard cardA">0</span>
            <span className="tableCard cardB">2</span>
            <span className="tableCard cardC">?</span>
            <span className="chipStack chipA" />
            <span className="chipStack chipB" />
          </div>
          <div className="tableGlow" />
        </div>

        <aside className="auditBoard" aria-label="Audit evidence board">
          <h3>Evidence Board</h3>
          <ul>
            <li>
              <strong>Seed replay</strong>
              <span>verified</span>
            </li>
            <li>
              <strong>Commitments</strong>
              <span>pending reveal</span>
            </li>
            <li>
              <strong>Anomaly scan</strong>
              <span>watching raise patterns</span>
            </li>
          </ul>
        </aside>
      </div>
    </section>
  );
}
