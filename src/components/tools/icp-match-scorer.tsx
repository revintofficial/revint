"use client";

import { useState, useMemo } from "react";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  background: "#0b0b0d",
  color: "#ededf0",
  border: "0.5px solid rgba(255,255,255,0.12)",
  borderRadius: 8,
  fontSize: 15,
  fontFamily: "inherit",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "rgba(237,237,240,0.8)",
  marginBottom: 6,
};

/**
 * ICP match scorer — eight heuristic questions about a prospect produce a
 * 0-100 match score with a tiered recommendation. The weights and thresholds
 * reflect Leadac AI's own agency playbook: vertical + geo density matter most;
 * website quality gap is next; buyer role alignment third.
 */
type Input = {
  verticalMatch: 0 | 1 | 2;
  geoDensity: 0 | 1 | 2;
  websiteGap: 0 | 1 | 2;
  budgetFit: 0 | 1 | 2;
  buyerRole: 0 | 1 | 2;
  bookingInfra: 0 | 1 | 2;
  reviewVolume: 0 | 1 | 2;
  ownerOperated: 0 | 1 | 2;
};

const WEIGHTS: Record<keyof Input, number> = {
  verticalMatch: 18,
  geoDensity: 16,
  websiteGap: 16,
  budgetFit: 13,
  buyerRole: 12,
  bookingInfra: 10,
  reviewVolume: 8,
  ownerOperated: 7,
};

function score(i: Input) {
  let total = 0;
  for (const k of Object.keys(WEIGHTS) as Array<keyof Input>) {
    total += (i[k] / 2) * WEIGHTS[k];
  }
  return Math.round(total);
}

function tier(s: number): {
  label: string;
  color: string;
  copy: string;
} {
  if (s >= 80) {
    return {
      label: "A — Pursue aggressively",
      color: "#A5B4FC",
      copy: "This prospect fits the Leadac playbook near-perfectly. Personalised opener + audit, move to call as fast as possible.",
    };
  }
  if (s >= 60) {
    return {
      label: "B — Standard sequence",
      color: "#86EFAC",
      copy: "Solid fit. Run the default postcode-niche sequence; expect typical reply rates (3-5%).",
    };
  }
  if (s >= 40) {
    return {
      label: "C — Low-priority touch",
      color: "#FDE68A",
      copy: "Marginal fit. Cheap automation only — don't burn personal-sender reputation on this segment.",
    };
  }
  return {
    label: "D — Skip",
    color: "#FCA5A5",
    copy: "Wrong ICP. Sending to this segment drags down list-wide deliverability and reply rate. Skip.",
  };
}

const QUESTIONS: Array<{
  key: keyof Input;
  question: string;
  options: [string, string, string];
  hint: string;
}> = [
  {
    key: "verticalMatch",
    question: "How well does the vertical match your offer?",
    options: [
      "Wrong vertical entirely",
      "Adjacent vertical",
      "Core target vertical",
    ],
    hint: "Your offer is calibrated for specific niches; reuse only works in adjacents.",
  },
  {
    key: "geoDensity",
    question: "Density of similar businesses in the target postcode?",
    options: [
      "Under 10 (too sparse)",
      "10-30 (workable)",
      "30+ (dense)",
    ],
    hint: "Density enables the send-20-measure-adjust loop.",
  },
  {
    key: "websiteGap",
    question: "Website quality gap?",
    options: [
      "Site is already modern",
      "Passable but dated",
      "Obviously broken / outdated",
    ],
    hint: "Bigger gap = more pitchable audit findings in email one.",
  },
  {
    key: "budgetFit",
    question: "Business revenue vs your offer price?",
    options: [
      "Offer is a stretch",
      "Offer is affordable",
      "Offer is an easy yes for them",
    ],
    hint: "Rough rule: monthly revenue ≥ 10× your fee.",
  },
  {
    key: "buyerRole",
    question: "Are you reaching the decision maker?",
    options: [
      "Generic contact only",
      "Gatekeeper with access",
      "Owner / founder directly",
    ],
    hint: "Local-service = almost always owner-operator.",
  },
  {
    key: "bookingInfra",
    question: "Does the prospect have modern booking infrastructure?",
    options: [
      "Fully solved (Calendly/Booksy)",
      "Partially (form-based only)",
      "None (phone / walk-in only)",
    ],
    hint: "Inverse signal — less infrastructure = bigger upside.",
  },
  {
    key: "reviewVolume",
    question: "Google review volume vs neighbourhood peers?",
    options: [
      "Way above average",
      "Roughly average",
      "Below average",
    ],
    hint: "Low review count is a pitchable opener angle.",
  },
  {
    key: "ownerOperated",
    question: "Owner-operated or franchise/chain?",
    options: [
      "Large chain (head-office buyer)",
      "Regional chain / franchise",
      "Owner-operated independent",
    ],
    hint: "Owner-operated = single-call decision.",
  },
];

export default function IcpMatchScorer() {
  const [answers, setAnswers] = useState<Input>({
    verticalMatch: 2,
    geoDensity: 2,
    websiteGap: 1,
    budgetFit: 1,
    buyerRole: 2,
    bookingInfra: 2,
    reviewVolume: 1,
    ownerOperated: 2,
  });
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState<"idle" | "ok" | "err">("idle");

  const total = useMemo(() => score(answers), [answers]);
  const t = tier(total);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    try {
      const res = await fetch("/api/leads/tool-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          tool: "icp-match-scorer",
          metrics: { ...answers, score: total, tier: t.label },
        }),
      });
      setSubmitted(res.ok ? "ok" : "err");
    } catch {
      setSubmitted("err");
    }
  }

  return (
    <div style={{ display: "grid", gap: 32 }}>
      <div
        style={{
          padding: "32px",
          background: "linear-gradient(180deg, #121214 0%, #0d0d10 100%)",
          border: `0.5px solid ${t.color}40`,
          borderRadius: 14,
        }}
      >
        <p
          style={{
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "rgba(237,237,240,0.6)",
            margin: "0 0 10px",
            fontWeight: 700,
          }}
        >
          ICP match score
        </p>
        <p
          style={{
            fontSize: 72,
            fontWeight: 800,
            color: "#ffffff",
            margin: "0 0 4px",
            letterSpacing: "-0.04em",
            lineHeight: 1,
          }}
        >
          {total}
          <span
            style={{
              fontSize: 20,
              color: "rgba(237,237,240,0.4)",
              marginLeft: 8,
              fontWeight: 500,
            }}
          >
            / 100
          </span>
        </p>
        <p
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: t.color,
            margin: "16px 0 8px",
          }}
        >
          Tier {t.label}
        </p>
        <p
          style={{
            fontSize: 14,
            color: "rgba(237,237,240,0.8)",
            margin: 0,
            lineHeight: 1.55,
          }}
        >
          {t.copy}
        </p>
      </div>

      <div
        style={{
          padding: "24px 28px",
          background: "#121214",
          border: "0.5px solid rgba(255,255,255,0.08)",
          borderRadius: 14,
        }}
      >
        <h2
          style={{
            fontSize: 13,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "rgba(165,180,252,0.9)",
            margin: "0 0 20px",
            fontWeight: 700,
          }}
        >
          Score your prospect
        </h2>
        <div style={{ display: "grid", gap: 20 }}>
          {QUESTIONS.map((q) => (
            <div key={q.key}>
              <label style={labelStyle}>{q.question}</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {q.options.map((opt, idx) => {
                  const active = answers[q.key] === idx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() =>
                        setAnswers({ ...answers, [q.key]: idx as 0 | 1 | 2 })
                      }
                      style={{
                        padding: "8px 14px",
                        background: active ? "#A5B4FC" : "#0b0b0d",
                        color: active ? "#0b0b0d" : "#ededf0",
                        border: active
                          ? "0.5px solid #A5B4FC"
                          : "0.5px solid rgba(255,255,255,0.12)",
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: active ? 700 : 500,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              <p
                style={{
                  fontSize: 12,
                  color: "rgba(237,237,240,0.5)",
                  marginTop: 6,
                }}
              >
                {q.hint}
              </p>
            </div>
          ))}
        </div>
      </div>

      <form
        onSubmit={handleEmail}
        style={{
          padding: "24px 28px",
          background: "rgba(165,180,252,0.06)",
          border: "0.5px solid rgba(165,180,252,0.18)",
          borderRadius: 14,
        }}
      >
        <h3
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "#ffffff",
            margin: "0 0 6px",
          }}
        >
          Email me a template for this tier
        </h3>
        <p
          style={{
            margin: "0 0 14px",
            fontSize: 14,
            color: "rgba(237,237,240,0.75)",
          }}
        >
          We'll send a sequence template tuned to tier {t.label[0]} prospects
          plus our postcode-niche playbook. No spam.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            type="email"
            required
            placeholder="you@agency.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ ...inputStyle, flex: "1 1 240px" }}
          />
          <button
            type="submit"
            style={{
              padding: "10px 22px",
              background: "#A5B4FC",
              color: "#0b0b0d",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Send it
          </button>
        </div>
        {submitted === "ok" && (
          <p style={{ marginTop: 12, fontSize: 13, color: "#A5B4FC" }}>
            Sent — check your inbox.
          </p>
        )}
        {submitted === "err" && (
          <p style={{ marginTop: 12, fontSize: 13, color: "#fca5a5" }}>
            Something went wrong. Try again in a moment.
          </p>
        )}
      </form>
    </div>
  );
}
