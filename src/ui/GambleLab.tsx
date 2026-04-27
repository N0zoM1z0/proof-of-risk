import { useState } from "react";
import {
  filterCatalog,
  type Readiness,
  type RoadmapPhase,
  type ZkPriority
} from "../gambles/catalog";
import { gambleCatalog } from "../gambles/catalogData";

const phases: Array<RoadmapPhase | "all"> = ["all", "phase-2", "phase-3", "phase-4", "phase-8", "future"];
const priorities: Array<ZkPriority | "all"> = ["all", "highest", "high", "medium", "low", "none"];
const readinessValues: Array<Readiness | "all"> = ["all", "core-mvp", "prototype", "expansion", "research"];

export function GambleLab() {
  const [phase, setPhase] = useState<RoadmapPhase | "all">("all");
  const [zkPriority, setZkPriority] = useState<ZkPriority | "all">("all");
  const [readiness, setReadiness] = useState<Readiness | "all">("all");
  const [maxComplexity, setMaxComplexity] = useState(5);
  const [selectedId, setSelectedId] = useState(gambleCatalog[0]?.id ?? "");
  const filtered = filterCatalog(gambleCatalog, { phase, zkPriority, readiness, maxComplexity });
  const selected = gambleCatalog.find((entry) => entry.id === selectedId) ?? filtered[0] ?? gambleCatalog[0];

  return (
    <section className="lab" aria-labelledby="lab-heading">
      <div className="labHeader">
        <div>
          <p className="eyebrow">Gamble Lab</p>
          <h2 id="lab-heading">Data-driven rules catalog</h2>
          <p>
            Runtime-safe original entries distilled from local audit research. Filters expose phase,
            complexity, readiness, and fairness priority without embedding rule logic in UI.
          </p>
        </div>
        <div className="metricCard">
          <strong>{filtered.length}</strong>
          <span>visible of {gambleCatalog.length}</span>
        </div>
      </div>

      <div className="filters" aria-label="Catalog filters">
        <label>
          Phase
          <select value={phase} onChange={(event) => setPhase(event.target.value as RoadmapPhase | "all")}>
            {phases.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label>
          ZK priority
          <select
            value={zkPriority}
            onChange={(event) => setZkPriority(event.target.value as ZkPriority | "all")}
          >
            {priorities.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label>
          Readiness
          <select
            value={readiness}
            onChange={(event) => setReadiness(event.target.value as Readiness | "all")}
          >
            {readinessValues.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label>
          Max complexity: {maxComplexity}
          <input
            type="range"
            min="1"
            max="5"
            value={maxComplexity}
            onChange={(event) => setMaxComplexity(Number(event.target.value))}
          />
        </label>
      </div>

      <div className="labGrid">
        <div className="catalogList" aria-label="Filtered gamble catalog">
          {filtered.map((entry) => (
            <button
              className={entry.id === selected?.id ? "catalogItem active" : "catalogItem"}
              key={entry.id}
              type="button"
              onClick={() => setSelectedId(entry.id)}
            >
              <span>{entry.title}</span>
              <small>
                {entry.phase} / C{entry.complexity} / {entry.zkPriority}
              </small>
            </button>
          ))}
        </div>

        {selected ? (
          <article className="catalogDetail">
            <h3>{selected.title}</h3>
            <p>{selected.summary}</p>
            <dl className="detailFacts">
              <div>
                <dt>Mechanism</dt>
                <dd>{selected.mechanism}</dd>
              </div>
              <div>
                <dt>Players</dt>
                <dd>{selected.players}</dd>
              </div>
              <div>
                <dt>Readiness</dt>
                <dd>{selected.readiness}</dd>
              </div>
            </dl>
            <CatalogList title="Hidden information" items={selected.hiddenInfo} />
            <CatalogList title="AI hooks" items={selected.aiHooks} />
            <CatalogList title="Fairness hooks" items={selected.fairnessHooks} />
          </article>
        ) : (
          <article className="catalogDetail">
            <h3>No entries match the active filters.</h3>
          </article>
        )}
      </div>
    </section>
  );
}

function CatalogList({ title, items }: { title: string; items: readonly string[] }) {
  return (
    <div className="catalogBullets">
      <h4>{title}</h4>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
