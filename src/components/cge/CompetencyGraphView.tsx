"use client";

import { useEffect, useMemo, useState } from "react";
import { AdvancedJson } from "@/components/admin/AdvancedDetails";

type Node = {
  id: string;
  name: string;
  domain: string;
  difficulty: string;
};

type Edge = { from: string; to: string; kind: string };

type LearnerNode = {
  competency_id: string;
  score: number;
  stage: string;
  samples: number;
  confidence: number;
};

export function CompetencyGraphView({ admin = false }: { admin?: boolean }) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [learnerNodes, setLearnerNodes] = useState<LearnerNode[]>([]);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [mastered, setMastered] = useState<string[]>([]);
  const [developing, setDeveloping] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [domain, setDomain] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rca, setRca] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/cge/graph");
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Failed to load graph");
          return;
        }
        setNodes(data.graph.nodes);
        setEdges(data.graph.edges);
        setLearnerNodes(data.learner?.nodes ?? []);
        setBlocked(data.learner?.blocked ?? []);
        setMastered(data.learner?.mastered ?? []);
        setDeveloping(data.learner?.developing ?? []);
      } catch {
        setError("Network error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const domains = useMemo(
    () => ["all", ...new Set(nodes.map((n) => n.domain))],
    [nodes],
  );

  const visible = nodes.filter((n) => {
    if (domain !== "all" && n.domain !== domain) return false;
    if (!filter) return true;
    const q = filter.toLowerCase();
    return n.name.toLowerCase().includes(q) || n.id.includes(q);
  });

  const stateById = useMemo(() => {
    const m = new Map(learnerNodes.map((n) => [n.competency_id, n]));
    return m;
  }, [learnerNodes]);

  function statusColor(id: string): string {
    if (mastered.includes(id)) return "var(--primary)";
    if (blocked.includes(id)) return "var(--outline)";
    if (developing.includes(id)) return "var(--tertiary, #b45309)";
    return "var(--outline-variant)";
  }

  async function runRca(id: string) {
    setExpanded(id);
    setError(null);
    try {
      const res = await fetch("/api/cge/rca", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ observedFailure: id, action: "supervisor" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "RCA failed");
        return;
      }
      setRca(JSON.stringify(data.report, null, 2));
    } catch {
      setError("Network error");
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--on-surface-variant)]">Loading graph…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search competencies"
          className="min-w-[200px] flex-1 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2 text-sm"
        />
        <select
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2 text-sm"
        >
          {domains.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(1.4, Number((z + 0.1).toFixed(1))))}
          className="rounded-lg border border-[var(--outline-variant)] px-3 py-2 text-sm"
        >
          Zoom +
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(0.7, Number((z - 0.1).toFixed(1))))}
          className="rounded-lg border border-[var(--outline-variant)] px-3 py-2 text-sm"
        >
          Zoom −
        </button>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="rounded-lg border border-[var(--outline-variant)] px-3 py-2 text-sm"
        >
          {collapsed ? "Expand" : "Collapse"}
        </button>
      </div>

      <div className="flex flex-wrap gap-3 text-[11px] text-[var(--on-surface-variant)]">
        <Legend color="var(--primary)" label="Mastered" />
        <Legend color="var(--tertiary, #b45309)" label="Developing" />
        <Legend color="var(--outline)" label="Blocked" />
        <Legend color="var(--outline-variant)" label="Not attempted" />
        <span>
          {nodes.length} nodes · {edges.length} edges
          {admin ? " · instructor mode" : ""}
        </span>
      </div>

      <ul
        className="grid gap-2 sm:grid-cols-2 origin-top-left transition-transform"
        style={{ transform: `scale(${zoom})`, width: `${100 / zoom}%` }}
      >
        {(collapsed ? visible.slice(0, 8) : visible).map((n) => {
          const st = stateById.get(n.id);
          const prereqs = edges
            .filter((e) => e.to === n.id && e.kind === "required")
            .map((e) => e.from);
          return (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => runRca(n.id)}
                className="w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-3 text-left transition hover:border-[var(--primary)]"
                style={{ borderLeftWidth: 4, borderLeftColor: statusColor(n.id) }}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{n.name}</span>
                  <span className="text-[10px] uppercase tracking-wide text-[var(--on-surface-variant)]">
                    {n.difficulty}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-[var(--on-surface-variant)]">
                  {n.domain}
                  {st
                    ? st.samples === 0
                      ? " · Baseline — not yet assessed · Insufficient evidence"
                      : ` · ${st.stage} · formative ${st.score} · conf ${st.confidence} · samples ${st.samples}`
                    : " · not attempted"}
                </p>
                {expanded === n.id && prereqs.length > 0 && (
                  <p className="mt-2 text-[11px] text-[var(--on-surface-variant)]">
                    Requires: {prereqs.map((p) => p.replace(/_/g, " ")).join(", ")}
                  </p>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {collapsed && visible.length > 8 ? (
        <p className="text-xs text-[var(--on-surface-variant)]">
          Showing 8 of {visible.length}. Expand to see the full pathway.
        </p>
      ) : null}

      {error && (
        <p className="text-sm text-[var(--error)]" role="alert">
          {error}
        </p>
      )}
      {rca ? (
        <AdvancedJson value={rca} title="Advanced details (root-cause report)" />
      ) : null}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-2.5 w-2.5 rounded-sm"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}
