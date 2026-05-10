"use client";

/**
 * Reasoning trace viewer — collapsible, three-section layout.
 *
 *   1. Evidence  (yellow dot)  — facts SDR_BRAIN read in.
 *   2. Inference (blue dot)    — sub-decisions per reasoner (BANT, why-now, ...).
 *   3. Decision  (green dot)   — the final NBA node.
 *
 * Contradictions are listed below the graph so the rep can see WHY the
 * brain preferred one signal over another. Resolution colour:
 *   - PREFER_FIRST / PREFER_SECOND → resolved (green)
 *   - BLEND                        → mediated  (amber)
 *   - ESCALATE                     → unresolved (red)
 */
import type {
  ReasoningGraph,
  ReasoningNode,
  ContradictionRecord,
} from "@/lib/sdr-brain/reasoning-graph";

const KIND_DOT: Record<ReasoningNode["kind"], string> = {
  EVIDENCE: "bg-[var(--leadac-warning)]",
  INFERENCE: "bg-[var(--leadac-info)]",
  DECISION: "bg-[var(--leadac-success)]",
};

const RESOLUTION_BADGE: Record<ContradictionRecord["resolution"], string> = {
  PREFER_FIRST: "border-[var(--leadac-success)] text-[var(--leadac-success)]",
  PREFER_SECOND: "border-[var(--leadac-success)] text-[var(--leadac-success)]",
  BLEND: "border-[var(--leadac-warning)] text-[var(--leadac-warning)]",
  ESCALATE: "border-[var(--leadac-error)] text-[var(--leadac-error)]",
};

export function ReasoningTraceExpandable({
  graph,
  contradictions,
}: {
  graph: ReasoningGraph;
  contradictions: ContradictionRecord[];
}) {
  const evidence = graph.nodes.filter((n) => n.kind === "EVIDENCE");
  const inferences = graph.nodes.filter((n) => n.kind === "INFERENCE");
  const decisions = graph.nodes.filter((n) => n.kind === "DECISION");

  return (
    <div className="space-y-4 rounded-md border border-[var(--leadac-border)] bg-[var(--leadac-bg)] p-3">
      <Section title="Evidence read" nodes={evidence} />
      <Section title="Sub-decisions" nodes={inferences} />
      <Section title="Final decision" nodes={decisions} />

      {contradictions.length > 0 ? (
        <div>
          <div className="mb-2 text-[10px] uppercase tracking-wide text-[var(--leadac-text-3)]">
            Conflicts arbitrated ({contradictions.length})
          </div>
          <ul className="space-y-2">
            {contradictions.map((c, i) => (
              <li
                key={i}
                className="rounded border border-[var(--leadac-border)] bg-[var(--leadac-card)] p-2 text-xs"
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] text-[var(--leadac-text-3)]">
                    {c.code}
                  </span>
                  <span
                    className={`rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${
                      RESOLUTION_BADGE[c.resolution]
                    }`}
                  >
                    {c.resolution.replace("_", " ").toLowerCase()}
                  </span>
                </div>
                <p className="text-[var(--leadac-text-2)]">{c.reason}</p>
                {c.resolverNote ? (
                  <p className="mt-1 text-[var(--leadac-text-3)]">
                    Resolver: {c.resolverNote}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="border-t border-[var(--leadac-border)] pt-2 text-[10px] text-[var(--leadac-text-3)]">
        Model {graph.modelVersion} · generated {new Date(graph.generatedAt).toLocaleString()}
      </div>
    </div>
  );
}

function Section({ title, nodes }: { title: string; nodes: ReasoningNode[] }) {
  if (nodes.length === 0) return null;
  return (
    <div>
      <div className="mb-1.5 text-[10px] uppercase tracking-wide text-[var(--leadac-text-3)]">
        {title} ({nodes.length})
      </div>
      <ul className="space-y-1.5">
        {nodes.map((n) => (
          <li key={n.id} className="flex items-start gap-2 text-xs">
            <span
              className={`mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${KIND_DOT[n.kind]}`}
            />
            <span className="min-w-0 flex-1 text-[var(--leadac-text-2)]">
              {n.content}
              <span className="ml-2 text-[10px] text-[var(--leadac-text-3)]">
                w={n.weight.toFixed(2)} · c={n.confidence.toFixed(2)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
