"use client";

import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  if (!content) return null;

  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let inList = false;
  let listItems: string[] = [];
  let listType: "ul" | "ol" = "ul";
  let inTable = false;
  let tableRows: string[][] = [];
  let tableHeader: string[] = [];

  function flushList() {
    if (listItems.length > 0) {
      const Tag = listType;
      elements.push(
        <Tag
          key={`list-${elements.length}`}
          className={cn(
            "space-y-1 mb-3",
            listType === "ul" ? "list-disc pl-5" : "list-decimal pl-5"
          )}
        >
          {listItems.map((item, i) => (
            <li key={i} className="text-sm text-white/60 leading-relaxed">
              {renderInline(item)}
            </li>
          ))}
        </Tag>
      );
      listItems = [];
      inList = false;
    }
  }

  function flushTable() {
    if (tableHeader.length > 0 || tableRows.length > 0) {
      elements.push(
        <div key={`table-${elements.length}`} className="overflow-x-auto mb-3 rounded-lg border border-white/10">
          <table className="w-full text-sm">
            {tableHeader.length > 0 && (
              <thead>
                <tr className="bg-white/5">
                  {tableHeader.map((cell, i) => (
                    <th key={i} className="px-3 py-2 text-left font-medium text-white/70 border-b border-white/10">
                      {renderInline(cell.trim())}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {tableRows.map((row, ri) => (
                <tr key={ri} className="border-b border-white/5 last:border-0">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 text-white/60">
                      {renderInline(cell.trim())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableHeader = [];
      tableRows = [];
      inTable = false;
    }
  }

  function renderInline(text: string): React.ReactNode {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      const codeMatch = remaining.match(/`(.+?)`/);

      let earliest = null;
      let earliestIdx = remaining.length;

      if (boldMatch && boldMatch.index !== undefined && boldMatch.index < earliestIdx) {
        earliest = { type: "bold", match: boldMatch };
        earliestIdx = boldMatch.index;
      }
      if (codeMatch && codeMatch.index !== undefined && codeMatch.index < earliestIdx) {
        earliest = { type: "code", match: codeMatch };
        earliestIdx = codeMatch.index;
      }

      if (!earliest) {
        parts.push(remaining);
        break;
      }

      if (earliestIdx > 0) {
        parts.push(remaining.slice(0, earliestIdx));
      }

      if (earliest.type === "bold") {
        parts.push(
          <strong key={key++} className="font-semibold text-white">
            {earliest.match[1]}
          </strong>
        );
        remaining = remaining.slice(earliestIdx + earliest.match[0].length);
      } else if (earliest.type === "code") {
        parts.push(
          <code key={key++} className="px-1.5 py-0.5 rounded-md bg-white/10 text-white/70 text-xs font-mono">
            {earliest.match[1]}
          </code>
        );
        remaining = remaining.slice(earliestIdx + earliest.match[0].length);
      }
    }

    return parts.length === 1 ? parts[0] : <>{parts}</>;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

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
          {renderInline(text)}
        </Tag>
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

    if (line.trim() === "") {
      continue;
    }

    if (line.startsWith(">")) {
      const text = line.replace(/^>\s?/, "");
      elements.push(
        <blockquote
          key={`bq-${i}`}
          className="border-l-3 border-(--leadac-500)/30 pl-3 my-2 text-sm text-white/50 italic"
        >
          {renderInline(text)}
        </blockquote>
      );
      continue;
    }

    if (line.startsWith("---") || line.startsWith("***")) {
      elements.push(<hr key={`hr-${i}`} className="my-3 border-white/10" />);
      continue;
    }

    elements.push(
      <p key={`p-${i}`} className="text-sm text-white/60 leading-relaxed mb-1.5">
        {renderInline(line)}
      </p>
    );
  }

  flushList();
  flushTable();

  return <div className={cn("space-y-0", className)}>{elements}</div>;
}
