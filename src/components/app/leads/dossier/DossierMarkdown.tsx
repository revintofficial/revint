/**
 * DossierMarkdown — markdown renderer for the AI Dossier that turns
 * citation tokens (`[website_audit]`, `[run:APIFY_FACEBOOK_DEEP]`,
 * `[memory:SOCIAL_POST]`) into interactive `<SourceChip>` components.
 *
 * Reuses the same line-by-line, regex-driven structure as
 * `MarkdownRenderer` (h1-h4, lists, tables, blockquotes, hr, bold,
 * code) but extends `renderInline` with a citation tokenizer that
 * runs in the same pass as bold + code.
 *
 * Per-paragraph dedupe: when the same citation tag appears more than
 * once in a single paragraph, only the first occurrence renders as a
 * chip; subsequent ones are dropped (and any whitespace immediately
 * before them collapsed). Keeps the prose readable when Gemini cites
 * the same source for adjacent claims.
 */
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { SourceChip } from "./SourceChip";
import {
  parseCitationToken,
  type CanonicalTag,
  type DossierSourcesPayload,
} from "./source-registry";

interface DossierMarkdownProps {
  markdown: string;
  sources: DossierSourcesPayload | null;
  onOpenSource: (tag: CanonicalTag) => void;
  className?: string;
}

/**
 * Stable identity for a citation tag — used by the per-paragraph
 * dedupe logic. Keeping the format flat (no JSON.stringify) avoids
 * accidental key collisions when adjacent paragraphs cite the same
 * tag (we WANT that to render twice, dedupe is paragraph-scoped).
 */
function tagKey(tag: CanonicalTag): string {
  switch (tag.kind) {
    case "native":
      return `native:${tag.key}`;
    case "run":
      return `run:${tag.workerKind}`;
    case "memory":
      return `memory:${tag.memoryKind}`;
    case "unknown":
      return `unknown:${tag.raw.toLowerCase()}`;
  }
}

export function DossierMarkdown({
  markdown,
  sources,
  onOpenSource,
  className,
}: DossierMarkdownProps) {
  if (!markdown) return null;

  const lines = markdown.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let inList = false;
  let listType: "ul" | "ol" = "ul";
  let inTable = false;
  let tableRows: string[][] = [];
  let tableHeader: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      const Tag = listType;
      const seen = new Set<string>();
      elements.push(
        <Tag
          key={`list-${elements.length}`}
          className={cn(
            "space-y-1 mb-3",
            listType === "ul" ? "list-disc pl-5" : "list-decimal pl-5",
          )}
        >
          {listItems.map((item, i) => (
            <li key={i} className="text-sm text-white/65 leading-relaxed">
              {renderInline(item, seen)}
            </li>
          ))}
        </Tag>,
      );
      listItems = [];
      inList = false;
    }
  };

  const flushTable = () => {
    if (tableHeader.length > 0 || tableRows.length > 0) {
      const seenHeader = new Set<string>();
      elements.push(
        <div
          key={`table-${elements.length}`}
          className="overflow-x-auto mb-3 rounded-lg border border-white/10"
        >
          <table className="w-full text-sm">
            {tableHeader.length > 0 && (
              <thead>
                <tr className="bg-white/5">
                  {tableHeader.map((cell, i) => (
                    <th
                      key={i}
                      className="px-3 py-2 text-left font-medium text-white/70 border-b border-white/10"
                    >
                      {renderInline(cell.trim(), seenHeader)}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {tableRows.map((row, ri) => {
                const seenRow = new Set<string>();
                return (
                  <tr key={ri} className="border-b border-white/5 last:border-0">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3 py-2 text-white/65">
                        {renderInline(cell.trim(), seenRow)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>,
      );
      tableHeader = [];
      tableRows = [];
      inTable = false;
    }
  };

  /**
   * Inline tokenizer. Walks the string left-to-right, looking for the
   * earliest match among **bold**, `code`, and citation `[token]`.
   *
   * The citation regex deliberately tolerates internal whitespace,
   * mixed case, and the `:` separator used by `run:KIND` /
   * `memory:KIND` tokens. It refuses to match brackets that span line
   * breaks (would let real prose like "[bracketed term]" leak in).
   *
   * `seenTags` is a per-paragraph set: if a citation token has already
   * rendered in this paragraph, subsequent occurrences are silently
   * dropped along with the whitespace immediately preceding them, so
   * the prose collapses gracefully instead of leaving a phantom space.
   */
  function renderInline(text: string, seenTags: Set<string>): React.ReactNode {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    // Single combined regex would be cleaner but we keep three because
    // each match can have different capture-group semantics.
    while (remaining.length > 0) {
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      const codeMatch = remaining.match(/`(.+?)`/);
      // Citation token: [a-zA-Z0-9_:]+ inside square brackets, no
      // newlines, no spaces. Keeps things deterministic.
      const citationMatch = remaining.match(/\[([A-Za-z][A-Za-z0-9_:]{0,80})\]/);

      type Candidate = { type: "bold" | "code" | "citation"; match: RegExpMatchArray; idx: number };
      const candidates: Candidate[] = [];
      if (boldMatch && boldMatch.index !== undefined) {
        candidates.push({ type: "bold", match: boldMatch, idx: boldMatch.index });
      }
      if (codeMatch && codeMatch.index !== undefined) {
        candidates.push({ type: "code", match: codeMatch, idx: codeMatch.index });
      }
      if (citationMatch && citationMatch.index !== undefined) {
        candidates.push({ type: "citation", match: citationMatch, idx: citationMatch.index });
      }
      if (candidates.length === 0) {
        parts.push(remaining);
        break;
      }
      candidates.sort((a, b) => a.idx - b.idx);
      const earliest = candidates[0];
      const before = remaining.slice(0, earliest.idx);
      const consumed = earliest.match[0];
      const after = remaining.slice(earliest.idx + consumed.length);

      if (earliest.type === "bold") {
        if (before) parts.push(before);
        parts.push(
          <strong key={`b-${key++}`} className="font-semibold text-white">
            {earliest.match[1]}
          </strong>,
        );
        remaining = after;
        continue;
      }
      if (earliest.type === "code") {
        if (before) parts.push(before);
        parts.push(
          <code
            key={`c-${key++}`}
            className="px-1.5 py-0.5 rounded-md bg-white/10 text-white/70 text-xs font-mono"
          >
            {earliest.match[1]}
          </code>,
        );
        remaining = after;
        continue;
      }

      // earliest.type === "citation"
      const tag = parseCitationToken(earliest.match[1]);
      const tk = tagKey(tag);
      if (seenTags.has(tk)) {
        // Drop the chip AND the leading whitespace right before it so
        // we don't leave a double space behind.
        parts.push(before.replace(/[ \t]+$/, ""));
        remaining = after;
        continue;
      }
      seenTags.add(tk);
      if (before) parts.push(before);
      parts.push(
        <SourceChip
          key={`s-${key++}`}
          tag={tag}
          sources={sources}
          onOpen={onOpenSource}
        />,
      );
      remaining = after;
    }

    return parts.length === 1 ? parts[0] : <>{parts}</>;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Markdown table support — a separator row of `|---|---|` resets
    // header → body. Anything between two non-pipe lines closes the
    // table back into prose.
    if (line.startsWith("|") && line.endsWith("|")) {
      const cells = line.slice(1, -1).split("|");
      if (cells.every((c) => c.trim().match(/^[-:]+$/))) {
        continue;
      }
      if (!inTable) {
        flushList();
        inTable = true;
        tableHeader = cells;
      } else {
        tableRows.push(cells);
      }
      continue;
    } else if (inTable) {
      flushTable();
    }

    if (line.match(/^#{1,3}\s/)) {
      flushList();
      const seen = new Set<string>();
      const level = line.match(/^(#+)/)?.[1].length || 1;
      const text = line.replace(/^#+\s/, "");
      const Tag = level === 1 ? "h2" : level === 2 ? "h3" : "h4";
      const sizeClass =
        level === 1
          ? "text-base font-semibold text-white mt-4 mb-2"
          : level === 2
          ? "text-sm font-semibold text-white mt-3 mb-1.5"
          : "text-sm font-medium text-white/70 mt-2 mb-1";
      elements.push(
        <Tag key={`h-${i}`} className={sizeClass}>
          {renderInline(text, seen)}
        </Tag>,
      );
      continue;
    }

    if (line.match(/^[-*]\s/) || line.match(/^\d+\.\s/)) {
      if (!inList) {
        flushList();
        inList = true;
        listType = line.match(/^\d+\./) ? "ol" : "ul";
      }
      const text = line.replace(/^[-*]\s/, "").replace(/^\d+\.\s/, "");
      listItems.push(text);
      continue;
    }

    if (inList) flushList();

    if (line.trim() === "") continue;

    if (line.startsWith(">")) {
      const seen = new Set<string>();
      const text = line.replace(/^>\s?/, "");
      elements.push(
        <blockquote
          key={`bq-${i}`}
          className="border-l-3 border-(--leadac-500)/30 pl-3 my-2 text-sm text-white/55 italic"
        >
          {renderInline(text, seen)}
        </blockquote>,
      );
      continue;
    }

    if (line.startsWith("---") || line.startsWith("***")) {
      elements.push(<hr key={`hr-${i}`} className="my-3 border-white/10" />);
      continue;
    }

    const seen = new Set<string>();
    elements.push(
      <p key={`p-${i}`} className="text-sm text-white/65 leading-relaxed mb-1.5">
        {renderInline(line, seen)}
      </p>,
    );
  }

  flushList();
  flushTable();

  return <div className={cn("space-y-0", className)}>{elements}</div>;
}
