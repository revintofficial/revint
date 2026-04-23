"use client";

import { Quote, ArrowUp, MessageCircle } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

interface ValidationQuoteProps {
  source: string;
  text: string;
  subreddit?: string;
  upvotes?: number;
  comments?: number;
  href?: string;
  accent?: string;
}

export function ValidationQuote({
  source,
  text,
  subreddit,
  upvotes,
  comments,
  href,
  accent = "#C49AFF",
}: ValidationQuoteProps) {
  const reduce = useReducedMotion();

  const inner = (
    <div
      className="relative px-5 py-5 rounded-2xl text-left h-full"
      style={{
        background:
          "linear-gradient(180deg, rgba(28,28,30,0.6), rgba(20,20,22,0.45))",
        border: "0.5px solid rgba(255,255,255,0.08)",
        boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset",
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: `${accent}1f`,
            border: `0.5px solid ${accent}40`,
          }}
        >
          <Quote className="w-4 h-4" style={{ color: accent }} />
        </div>
        <div className="flex-1 min-w-0">
          {subreddit && (
            <div className="flex items-center gap-2 mb-2">
              <span
                className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-semibold tracking-wide"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "0.5px solid rgba(255,255,255,0.08)",
                  color: accent,
                }}
              >
                r/{subreddit}
              </span>
              {(upvotes !== undefined || comments !== undefined) && (
                <div className="flex items-center gap-3 text-[11px] text-white/40">
                  {upvotes !== undefined && (
                    <span className="flex items-center gap-1">
                      <ArrowUp className="w-3 h-3" />
                      {upvotes}
                    </span>
                  )}
                  {comments !== undefined && (
                    <span className="flex items-center gap-1">
                      <MessageCircle className="w-3 h-3" />
                      {comments}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
          <p
            className="text-[10.5px] uppercase tracking-[0.12em] font-semibold mb-1.5"
            style={{ color: accent }}
          >
            {source}
          </p>
          <p className="text-[13.5px] text-white/75 leading-relaxed">
            &ldquo;{text}&rdquo;
          </p>
        </div>
      </div>
    </div>
  );

  const wrapped = href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="block">
      {inner}
    </a>
  ) : (
    inner
  );

  if (reduce) {
    return <div>{wrapped}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ type: "spring", stiffness: 220, damping: 28 }}
    >
      {wrapped}
    </motion.div>
  );
}
