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

const helpStyle: React.CSSProperties = {
  fontSize: 12,
  color: "rgba(237,237,240,0.5)",
  marginTop: 4,
};

type Metrics = {
  sends: number;
  replyRate: number;
  positiveRate: number;
  bookingRate: number;
  dealRate: number;
  dealValue: number;
};

function format(n: number, digits = 0) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function money(n: number) {
  return "$" + format(Math.round(n));
}

function compute(m: Metrics) {
  const replies = m.sends * (m.replyRate / 100);
  const positive = replies * (m.positiveRate / 100);
  const meetings = positive * (m.bookingRate / 100);
  const deals = meetings * (m.dealRate / 100);
  const revenue = deals * m.dealValue;
  return { replies, positive, meetings, deals, revenue };
}

export default function ReplyRateCalculator() {
  const [sends, setSends] = useState(2000);
  const [replyRate, setReplyRate] = useState(3);
  const [positiveRate, setPositiveRate] = useState(30);
  const [bookingRate, setBookingRate] = useState(40);
  const [dealRate, setDealRate] = useState(20);
  const [dealValue, setDealValue] = useState(3000);
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState<"idle" | "ok" | "err">("idle");

  const result = useMemo(
    () =>
      compute({
        sends,
        replyRate,
        positiveRate,
        bookingRate,
        dealRate,
        dealValue,
      }),
    [sends, replyRate, positiveRate, bookingRate, dealRate, dealValue],
  );

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    try {
      const res = await fetch("/api/leads/tool-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          tool: "cold-email-reply-rate-calculator",
          metrics: {
            sends,
            replyRate,
            positiveRate,
            bookingRate,
            dealRate,
            dealValue,
            projectedRevenue: result.revenue,
          },
        }),
      });
      setSubmitted(res.ok ? "ok" : "err");
    } catch {
      setSubmitted("err");
    }
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr",
        gap: 32,
      }}
    >
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
          Inputs
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 18,
          }}
        >
          <div>
            <label style={labelStyle} htmlFor="sends">
              Emails sent per month
            </label>
            <input
              id="sends"
              type="number"
              min={1}
              style={inputStyle}
              value={sends}
              onChange={(e) => setSends(Number(e.target.value) || 0)}
            />
            <p style={helpStyle}>Total send volume across all senders.</p>
          </div>
          <div>
            <label style={labelStyle} htmlFor="replyRate">
              Reply rate (%)
            </label>
            <input
              id="replyRate"
              type="number"
              step={0.1}
              min={0}
              max={100}
              style={inputStyle}
              value={replyRate}
              onChange={(e) => setReplyRate(Number(e.target.value) || 0)}
            />
            <p style={helpStyle}>Apollo benchmark 0.3%; grounded 3-7%.</p>
          </div>
          <div>
            <label style={labelStyle} htmlFor="positiveRate">
              Positive-reply share (%)
            </label>
            <input
              id="positiveRate"
              type="number"
              step={1}
              min={0}
              max={100}
              style={inputStyle}
              value={positiveRate}
              onChange={(e) => setPositiveRate(Number(e.target.value) || 0)}
            />
            <p style={helpStyle}>Of replies, what share is interested?</p>
          </div>
          <div>
            <label style={labelStyle} htmlFor="bookingRate">
              Positive → meeting booked (%)
            </label>
            <input
              id="bookingRate"
              type="number"
              step={1}
              min={0}
              max={100}
              style={inputStyle}
              value={bookingRate}
              onChange={(e) => setBookingRate(Number(e.target.value) || 0)}
            />
            <p style={helpStyle}>Typical 30-50%.</p>
          </div>
          <div>
            <label style={labelStyle} htmlFor="dealRate">
              Meeting → closed deal (%)
            </label>
            <input
              id="dealRate"
              type="number"
              step={1}
              min={0}
              max={100}
              style={inputStyle}
              value={dealRate}
              onChange={(e) => setDealRate(Number(e.target.value) || 0)}
            />
            <p style={helpStyle}>Close rate off discovery.</p>
          </div>
          <div>
            <label style={labelStyle} htmlFor="dealValue">
              Average deal value ($)
            </label>
            <input
              id="dealValue"
              type="number"
              step={100}
              min={0}
              style={inputStyle}
              value={dealValue}
              onChange={(e) => setDealValue(Number(e.target.value) || 0)}
            />
            <p style={helpStyle}>Contract value, not MRR.</p>
          </div>
        </div>
      </div>

      <div
        style={{
          padding: "28px 32px",
          background: "linear-gradient(180deg, #121214 0%, #0d0d10 100%)",
          border: "0.5px solid rgba(165,180,252,0.25)",
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
          Projected funnel
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 16,
          }}
        >
          <Stat label="Replies" value={format(result.replies, 0)} />
          <Stat label="Positive replies" value={format(result.positive, 0)} />
          <Stat label="Meetings booked" value={format(result.meetings, 1)} />
          <Stat label="Deals closed" value={format(result.deals, 1)} />
        </div>
        <div
          style={{
            marginTop: 24,
            paddingTop: 24,
            borderTop: "0.5px solid rgba(255,255,255,0.08)",
          }}
        >
          <p
            style={{
              fontSize: 13,
              color: "rgba(237,237,240,0.6)",
              margin: "0 0 4px",
            }}
          >
            Projected monthly revenue
          </p>
          <p
            style={{
              fontSize: 44,
              fontWeight: 800,
              color: "#ffffff",
              margin: 0,
              letterSpacing: "-0.03em",
            }}
          >
            {money(result.revenue)}
          </p>
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
          Email me this projection
        </h3>
        <p
          style={{
            margin: "0 0 14px",
            fontSize: 14,
            color: "rgba(237,237,240,0.75)",
          }}
        >
          We'll send a copy of this projection plus the Leadac AI
          postcode-niche playbook. No spam.
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
              background: "var(--leadac-300)",
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
          <p
            style={{
              marginTop: 12,
              fontSize: 13,
              color: "var(--leadac-300)",
            }}
          >
            Sent — check your inbox.
          </p>
        )}
        {submitted === "err" && (
          <p
            style={{
              marginTop: 12,
              fontSize: 13,
              color: "hsl(4 42% 72%)",
            }}
          >
            Something went wrong. Try again in a moment.
          </p>
        )}
      </form>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p
        style={{
          fontSize: 12,
          color: "rgba(237,237,240,0.55)",
          margin: "0 0 4px",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: 26,
          fontWeight: 700,
          color: "#ffffff",
          margin: 0,
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </p>
    </div>
  );
}
