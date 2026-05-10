/**
 * SDR Brain v2 — reasoning graph types.
 *
 * Every `LeadNextAction.reasoningGraph` Json column conforms to the
 * `ReasoningGraph` shape declared here. The UI's "Why?" expandable on
 * the lead detail page reads the graph directly; the OUTCOME_ATTRIBUTOR
 * worker walks it to attribute success / failure back to the cited
 * triggers and insights.
 *
 * Sizing: most graphs are ≤30 nodes. When SDR_BRAIN produces a larger
 * graph, the inline `reasoningGraph` carries a summary subset and the
 * full graph is written to the opt-in `ReasoningTrace` table (Phase 2).
 *
 * Node id conventions (free-form strings, but follow these prefixes
 * so the UI viewer can colour-code):
 *   - "trigger.<id>"        : LeadTrigger evidence
 *   - "icp.score"           : ICP fit scalar
 *   - "audit.checklist"     : audit-derived signal
 *   - "ev.review.<id>"      : reviewAnalysis evidence
 *   - "insight.<id>"        : commercial insight reference
 *   - "bant.<dimension>"    : BANT derive output (budget/authority/need/timing)
 *   - "committee.<role>"    : stakeholder map node
 *   - "decision"            : the LeadNextAction itself (kind)
 */
export type ReasoningNodeKind = "EVIDENCE" | "INFERENCE" | "DECISION";
export type ReasoningEdgeType = "SUPPORTS" | "CONTRADICTS" | "DERIVES" | "OVERRIDES";

export interface ReasoningNode {
  id: string;
  kind: ReasoningNodeKind;
  source?: {
    workerKind?: string;
    refType?: string;
    refId?: string;
  };
  /** 0..1 — weight of this node in the final decision. */
  weight: number;
  /** 0..1 — how confident we are the node's content is correct. */
  confidence: number;
  /** Short prose explanation; <=200 chars. */
  content: string;
}

export interface ReasoningEdge {
  from: string;
  to: string;
  type: ReasoningEdgeType;
}

export type ContradictionResolution =
  | "PREFER_FIRST"
  | "PREFER_SECOND"
  | "BLEND"
  | "ESCALATE";

/**
 * One row per detected conflict between two upstream signals. Every
 * SDR_BRAIN run emits an `arbitration[]` log; rows are mirrored into
 * the inline reasoning graph as edges of type CONTRADICTS plus
 * SUPPORTS edges from the resolution.
 */
export interface ContradictionRecord {
  /** Stable code from `contradictions.ts` (e.g. "BANT_TIMING_VS_WHY_NOW_URGENCY"). */
  code: string;
  fromNodeId: string;
  toNodeId: string;
  /** Human-readable summary, ≤200 chars. */
  reason: string;
  resolution: ContradictionResolution;
  resolverNote: string;
}

export interface ReasoningGraph {
  nodes: ReasoningNode[];
  edges: ReasoningEdge[];
  contradictions: ContradictionRecord[];
  modelVersion: string;
  generatedAt: string;
}

/**
 * Fluent builder used by SDR_BRAIN and the ICP / BANT helpers to
 * construct reasoning graphs without directly mutating arrays. Keeps
 * the JSON shape consistent and makes unit tests trivial.
 */
export class ReasoningGraphBuilder {
  private nodes = new Map<string, ReasoningNode>();
  private edges: ReasoningEdge[] = [];
  private contradictions: ContradictionRecord[] = [];
  constructor(private readonly modelVersion: string) {}

  addNode(node: ReasoningNode): this {
    // Last write wins for the same id — callers that want to cite the
    // same evidence twice should disambiguate by id.
    this.nodes.set(node.id, node);
    return this;
  }

  addEvidence(
    id: string,
    content: string,
    weight: number,
    confidence: number,
    source?: ReasoningNode["source"],
  ): this {
    return this.addNode({ id, kind: "EVIDENCE", content, weight, confidence, source });
  }

  addInference(id: string, content: string, weight: number, confidence: number): this {
    return this.addNode({ id, kind: "INFERENCE", content, weight, confidence });
  }

  addDecision(id: string, content: string, weight: number, confidence: number): this {
    return this.addNode({ id, kind: "DECISION", content, weight, confidence });
  }

  addEdge(edge: ReasoningEdge): this {
    this.edges.push(edge);
    return this;
  }

  link(from: string, to: string, type: ReasoningEdgeType): this {
    return this.addEdge({ from, to, type });
  }

  addContradiction(record: ContradictionRecord): this {
    this.contradictions.push(record);
    // Mirror into the edge list so a graph viewer doesn't need to
    // join the two arrays to render the conflict line.
    this.edges.push({ from: record.fromNodeId, to: record.toNodeId, type: "CONTRADICTS" });
    return this;
  }

  build(): ReasoningGraph {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: this.edges,
      contradictions: this.contradictions,
      modelVersion: this.modelVersion,
      generatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Sanity check used by tests + the SDR_BRAIN finalize step. Throws
 * if the graph references undeclared node ids or carries duplicate
 * edges. We don't run this in production hot paths — the builder
 * already guarantees node uniqueness — but the test suite uses it as
 * a regression guard against schema drift.
 */
export function assertGraphIntegrity(graph: ReasoningGraph): void {
  const nodeIds = new Set(graph.nodes.map((n) => n.id));
  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.from)) {
      throw new Error(`reasoning_graph: edge from unknown node "${edge.from}"`);
    }
    if (!nodeIds.has(edge.to)) {
      throw new Error(`reasoning_graph: edge to unknown node "${edge.to}"`);
    }
  }
  for (const c of graph.contradictions) {
    if (!nodeIds.has(c.fromNodeId)) {
      throw new Error(`reasoning_graph: contradiction from unknown node "${c.fromNodeId}"`);
    }
    if (!nodeIds.has(c.toNodeId)) {
      throw new Error(`reasoning_graph: contradiction to unknown node "${c.toNodeId}"`);
    }
  }
}
