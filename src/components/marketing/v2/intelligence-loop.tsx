/**
 * Intelligence loop section with a static memory-graph visual.
 *
 * Design intent: communicate that the system gets smarter per workspace
 * over time. The graph is hand-laid in a small inline SVG: six labeled
 * nodes arranged in a loose cluster, connected by thin curved lines
 * tinted with the leadac brand color, plus three floating proof
 * badges that hint at outcomes the loop produces. Below the graph,
 * three short proof cards spell out what the graph means in words.
 * Pure server, no JS, no Framer. Curves and dot pulses are CSS only.
 */
import * as React from "react";
import { Section } from "./section";

interface Node {
  id: string;
  label: string;
  x: number;
  y: number;
}

const NODES: Node[] = [
  { id: "a", label: "Independent Italian, 2 locations", x: 18, y: 24 },
  { id: "b", label: "Casual dining, growing chain", x: 50, y: 14 },
  { id: "c", label: "Coffee + bakery, single site", x: 82, y: 26 },
  { id: "d", label: "On Square POS", x: 22, y: 70 },
  { id: "e", label: "On Toast", x: 54, y: 78 },
  { id: "f", label: "No POS detected", x: 84, y: 66 },
];

const EDGES: Array<[string, string]> = [
  ["a", "b"],
  ["b", "c"],
  ["a", "d"],
  ["b", "e"],
  ["c", "f"],
  ["d", "e"],
  ["e", "f"],
  ["a", "e"],
  ["c", "b"],
];

const PROOF_CARDS: Array<{ title: string; body: string }> = [
  {
    title: "Closed-deal graph",
    body: "Every closed-won and closed-lost reason from your CRM feeds tomorrow's account list, scoped to your workspace. The next list is sharper than the last.",
  },
  {
    title: "Segment memory",
    body: "The proof points that close a two-location independent Italian on Square POS do not get recycled blindly into a single-site coffee shop. Each segment has its own talk-track memory.",
  },
  {
    title: "ICP refinement",
    body: 'Over time the system surfaces rules. "Multi-location independent restaurant, on Square or Toast, no QR ordering live" reliably converts past discovery — the next list overweights that pattern.',
  },
];

function nodeById(id: string): Node {
  const n = NODES.find((x) => x.id === id);
  if (!n) throw new Error(`unknown node ${id}`);
  return n;
}

export function IntelligenceLoop() {
  return (
    <Section
      eyebrow="Closed-loop learning"
      headline="Every won and lost deal sharpens the next list."
      sub="LeadAC learns which vertical sub-segments convert, which proof points close, and which accounts to prioritise next. The model gets sharper per workspace with every closed deal — closed-won, closed-lost, and stalled-pipeline all feed the next reasoning step."
    >
      <div
        className="relative mx-auto max-w-3xl rounded-2xl border border-white/[0.06] overflow-hidden"
        style={{
          background:
            "linear-gradient(180deg, hsl(var(--leadac-h) var(--leadac-ns) 10%) 0%, hsl(var(--leadac-h) var(--leadac-ns) 7%) 100%)",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 60% at 50% 50%, hsl(var(--leadac-h) var(--leadac-s) 50% / 0.10), transparent 70%)",
          }}
        />

        <div className="relative aspect-[16/10] w-full">
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
            aria-hidden
          >
            <defs>
              <linearGradient id="memoryEdge" x1="0" y1="0" x2="1" y2="1">
                <stop
                  offset="0%"
                  stopColor="hsl(var(--leadac-h) var(--leadac-s) 60%)"
                  stopOpacity="0.55"
                />
                <stop
                  offset="100%"
                  stopColor="hsl(var(--leadac-h) var(--leadac-s) 60%)"
                  stopOpacity="0.15"
                />
              </linearGradient>
            </defs>

            {EDGES.map(([from, to]) => {
              const a = nodeById(from);
              const b = nodeById(to);
              const mx = (a.x + b.x) / 2;
              const my = (a.y + b.y) / 2 - 6;
              return (
                <path
                  key={`${from}-${to}`}
                  d={`M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`}
                  fill="none"
                  stroke="url(#memoryEdge)"
                  strokeWidth="0.35"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}

            {NODES.map((n) => (
              <g key={n.id}>
                <circle
                  cx={n.x}
                  cy={n.y}
                  r="0.9"
                  fill="hsl(var(--leadac-h) var(--leadac-s) 70%)"
                />
                <circle
                  cx={n.x}
                  cy={n.y}
                  r="2.2"
                  fill="none"
                  stroke="hsl(var(--leadac-h) var(--leadac-s) 60% / 0.35)"
                  strokeWidth="0.25"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            ))}
          </svg>

          {NODES.map((n) => (
            <span
              key={n.id}
              className="absolute -translate-x-1/2 translate-y-3 whitespace-nowrap rounded-md border border-white/[0.06] bg-black/55 backdrop-blur-sm px-2 py-1 text-[10.5px] md:text-[11.5px] font-medium text-white/80"
              style={{ left: `${n.x}%`, top: `${n.y}%` }}
            >
              {n.label}
            </span>
          ))}

          <div className="pointer-events-none absolute inset-0">
            <span
              className="absolute left-[8%] top-[48%] rounded-full px-2.5 py-1 text-[10.5px] font-semibold"
              style={{
                background: "hsl(var(--leadac-h) var(--leadac-s) 50% / 0.12)",
                color: "hsl(var(--leadac-h) var(--leadac-s) 80%)",
                border:
                  "1px solid hsl(var(--leadac-h) var(--leadac-s) 50% / 0.30)",
              }}
            >
              reply rate +14%
            </span>
            <span
              className="absolute right-[6%] top-[44%] rounded-full px-2.5 py-1 text-[10.5px] font-semibold"
              style={{
                background: "hsl(var(--leadac-h) var(--leadac-s) 50% / 0.12)",
                color: "hsl(var(--leadac-h) var(--leadac-s) 80%)",
                border:
                  "1px solid hsl(var(--leadac-h) var(--leadac-s) 50% / 0.30)",
              }}
            >
              pipeline +3
            </span>
            <span
              className="absolute left-1/2 bottom-[6%] -translate-x-1/2 rounded-full px-2.5 py-1 text-[10.5px] font-semibold"
              style={{
                background: "hsl(var(--leadac-h) var(--leadac-s) 50% / 0.12)",
                color: "hsl(var(--leadac-h) var(--leadac-s) 80%)",
                border:
                  "1px solid hsl(var(--leadac-h) var(--leadac-s) 50% / 0.30)",
              }}
            >
              ICP sharper
            </span>
          </div>
        </div>
      </div>

      <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
        {PROOF_CARDS.map((card) => (
          <div
            key={card.title}
            className="rounded-2xl border border-white/[0.06] bg-[hsl(var(--leadac-h)_var(--leadac-ns)_9%)] p-6"
          >
            <h3 className="text-[15px] font-semibold text-white">
              {card.title}
            </h3>
            <p className="mt-2 text-[13.5px] text-white/60 leading-relaxed">
              {card.body}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}
