"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";

interface WatchlistItem {
  id: string;
  leadId: string;
  siteUrl: string | null;
  notes: string | null;
  websitePlan: string | null;
  pipelineNotes: string | null;
  selectedOffer: "STARTER" | "GROWTH" | "SALES" | null;
  meetingResult: "POSITIVE" | "NEGATIVE" | "IN_PROGRESS" | null;
  createdAt: string;
  updatedAt: string;
  lead: {
    id: string;
    businessName: string;
    formattedAddress: string;
    borough: string | null;
    phone: string | null;
    websiteUrl: string | null;
    analyzeStatus: string;
    salesOpportunity: {
      opportunityScore: number;
      suggestedOffer: string;
      status: string;
      expectedPriceBand?: string | null;
    } | null;
  };
}

type StageFilter = "ALL" | "POSITIVE" | "IN_PROGRESS" | "NEGATIVE" | "PENDING";

export default function PipelinePage() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState<StageFilter>("ALL");

  const fetchWatchlist = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/watchlist");
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.items || []);
    } catch (err) {
      console.error("Failed to fetch watchlist:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

  const positiveCount = items.filter((i) => i.meetingResult === "POSITIVE").length;
  const negativeCount = items.filter((i) => i.meetingResult === "NEGATIVE").length;
  const inProgressCount = items.filter((i) => i.meetingResult === "IN_PROGRESS").length;
  const pendingCount = items.filter((i) => !i.meetingResult).length;

  const filteredItems = items.filter((item) => {
    if (stageFilter === "ALL") return true;
    if (stageFilter === "POSITIVE") return item.meetingResult === "POSITIVE";
    if (stageFilter === "NEGATIVE") return item.meetingResult === "NEGATIVE";
    if (stageFilter === "IN_PROGRESS") return item.meetingResult === "IN_PROGRESS";
    if (stageFilter === "PENDING") return !item.meetingResult;
    return true;
  });

  const STAGE_TABS: { value: StageFilter; label: string; count: number; activeColor: string }[] = [
    { value: "ALL", label: "Tumu", count: items.length, activeColor: "bg-zinc-900 text-white" },
    { value: "PENDING", label: "Bekleyen", count: pendingCount, activeColor: "bg-zinc-600 text-white" },
    { value: "IN_PROGRESS", label: "Devam Ediyor", count: inProgressCount, activeColor: "bg-amber-600 text-white" },
    { value: "POSITIVE", label: "Olumlu", count: positiveCount, activeColor: "bg-emerald-600 text-white" },
    { value: "NEGATIVE", label: "Olumsuz", count: negativeCount, activeColor: "bg-red-600 text-white" },
  ];

  return (
    <div className="p-4 md:p-8 space-y-4 md:space-y-6">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Sales Pipeline</h2>
        <p className="text-zinc-500 mt-1 text-sm">
          {loading ? "Yukleniyor..." : `${items.length} dukkan pipeline'da`}
        </p>
      </div>

      {!loading && items.length > 0 && (
        <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-lg w-fit max-w-full overflow-x-auto">
          {STAGE_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStageFilter(tab.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                stageFilter === tab.value
                  ? tab.activeColor + " shadow-sm"
                  : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50"
              }`}
            >
              {tab.label}
              <span
                className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                  stageFilter === tab.value ? "bg-white/20" : "bg-zinc-200 text-zinc-500"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-600" />
        </div>
      )}

      {!loading && items.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-zinc-400">
              <p className="text-lg font-medium">Pipeline bos</p>
              <p className="text-sm mt-1">
                Watchlist&apos;e lead ekleyerek pipeline&apos;a dukkan ekleyebilirsiniz.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && items.length > 0 && filteredItems.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-zinc-400">
              <p className="text-lg font-medium">Bu filtreye uygun dukkan bulunamadi</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-6">
        {filteredItems.map((item) => (
          <PipelineCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

function PipelineCard({ item }: { item: WatchlistItem }) {
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveNotes = useCallback(
    async (html: string) => {
      setSaving(true);
      try {
        await fetch(`/api/watchlist/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pipelineNotes: html }),
        });
        setLastSaved(new Date().toLocaleTimeString("tr-TR"));
      } catch (err) {
        console.error("Failed to save pipeline notes:", err);
      } finally {
        setSaving(false);
      }
    },
    [item.id]
  );

  const debouncedSave = useCallback(
    (html: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => saveNotes(html), 1500);
    },
    [saveNotes]
  );

  const opp = item.lead.salesOpportunity;

  const meetingBadge = item.meetingResult === "POSITIVE"
    ? { label: "Olumlu", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" }
    : item.meetingResult === "IN_PROGRESS"
      ? { label: "Devam Ediyor", cls: "bg-amber-100 text-amber-700 border-amber-200" }
      : item.meetingResult === "NEGATIVE"
        ? { label: "Olumsuz", cls: "bg-red-100 text-red-700 border-red-200" }
        : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="text-base sm:text-lg">
              <a href={`/leads/${item.lead.id}`} className="hover:underline">
                {item.lead.businessName}
              </a>
            </CardTitle>
            <p className="text-sm text-zinc-500 mt-0.5 truncate">{item.lead.formattedAddress}</p>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              {item.lead.phone && (
                <span className="text-xs text-zinc-500">{item.lead.phone}</span>
              )}
              {item.lead.websiteUrl && (
                <a
                  href={item.lead.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-indigo-600 hover:underline truncate max-w-[200px]"
                >
                  {item.lead.websiteUrl}
                </a>
              )}
              {item.siteUrl && (
                <a
                  href={item.siteUrl.startsWith("http") ? item.siteUrl : `https://${item.siteUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-emerald-600 hover:underline"
                >
                  Yapilan Site
                </a>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0">
            {saving && <span className="text-xs text-zinc-400 animate-pulse">Kaydediliyor...</span>}
            {!saving && lastSaved && <span className="text-xs text-emerald-500">Kaydedildi {lastSaved}</span>}
            {meetingBadge && <Badge className={meetingBadge.cls}>{meetingBadge.label}</Badge>}
            {item.lead.borough && <Badge variant="outline">{item.lead.borough}</Badge>}
            {opp && (
              <Badge
                variant={
                  opp.opportunityScore >= 60
                    ? "success"
                    : opp.opportunityScore >= 35
                      ? "warning"
                      : "secondary"
                }
              >
                Skor: {opp.opportunityScore}
              </Badge>
            )}
            {item.selectedOffer && (
              <Badge
                className={
                  item.selectedOffer === "STARTER"
                    ? "bg-emerald-100 text-emerald-700"
                    : item.selectedOffer === "GROWTH"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-purple-100 text-purple-700"
                }
              >
                {item.selectedOffer}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <RichTextEditor
          initialContent={item.pipelineNotes || ""}
          onUpdate={debouncedSave}
        />
      </CardContent>
    </Card>
  );
}

function RichTextEditor({
  initialContent,
  onUpdate,
}: {
  initialContent: string;
  onUpdate: (html: string) => void;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: initialContent,
    onUpdate: ({ editor }) => {
      onUpdate(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[200px] p-4",
      },
    },
  });

  if (!editor) return null;

  return (
    <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;

  const btnClass = (active: boolean) =>
    `p-1.5 rounded transition-colors ${
      active ? "bg-zinc-200 text-zinc-900" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
    }`;

  const divider = <div className="w-px h-6 bg-zinc-200 mx-1" />;

  return (
    <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-zinc-200 bg-zinc-50">
      {/* Text formatting */}
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={btnClass(editor.isActive("bold"))}
        title="Kalin"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z" />
          <path d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" />
        </svg>
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={btnClass(editor.isActive("italic"))}
        title="Italik"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <line x1="19" y1="4" x2="10" y2="4" />
          <line x1="14" y1="20" x2="5" y2="20" />
          <line x1="15" y1="4" x2="9" y2="20" />
        </svg>
      </button>
      <button
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={btnClass(editor.isActive("underline"))}
        title="Alti Cizili"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M6 3v7a6 6 0 006 6 6 6 0 006-6V3" />
          <line x1="4" y1="21" x2="20" y2="21" />
        </svg>
      </button>
      <button
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={btnClass(editor.isActive("strike"))}
        title="Ustu Cizili"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M17.3 4.9c-2.3-.6-4.4-1-6.2-.5C9.7 4.7 8 5.6 8 7.5c0 1.4 1 2.1 3.2 2.6" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <path d="M15 12.5c2.7.7 3.5 2 3.5 3.5 0 2.5-2.5 3.5-4.5 3.5s-3.5-.5-5-2" />
        </svg>
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHighlight({ color: "#fef08a" }).run()}
        className={btnClass(editor.isActive("highlight"))}
        title="Vurgula"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
          <rect x="3" y="19" width="8" height="2" rx="1" fill="#fef08a" stroke="none" />
        </svg>
      </button>

      {divider}

      {/* Headings */}
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={btnClass(editor.isActive("heading", { level: 1 }))}
        title="Baslik 1"
      >
        <span className="text-xs font-bold w-4 h-4 flex items-center justify-center">H1</span>
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={btnClass(editor.isActive("heading", { level: 2 }))}
        title="Baslik 2"
      >
        <span className="text-xs font-bold w-4 h-4 flex items-center justify-center">H2</span>
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={btnClass(editor.isActive("heading", { level: 3 }))}
        title="Baslik 3"
      >
        <span className="text-xs font-bold w-4 h-4 flex items-center justify-center">H3</span>
      </button>

      {divider}

      {/* Lists */}
      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={btnClass(editor.isActive("bulletList"))}
        title="Madde Listesi"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <circle cx="4" cy="6" r="1" fill="currentColor" />
          <circle cx="4" cy="12" r="1" fill="currentColor" />
          <circle cx="4" cy="18" r="1" fill="currentColor" />
        </svg>
      </button>
      <button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={btnClass(editor.isActive("orderedList"))}
        title="Numarali Liste"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <line x1="10" y1="6" x2="21" y2="6" />
          <line x1="10" y1="12" x2="21" y2="12" />
          <line x1="10" y1="18" x2="21" y2="18" />
          <text x="2" y="8" fontSize="8" fill="currentColor" stroke="none" fontWeight="bold">1</text>
          <text x="2" y="14" fontSize="8" fill="currentColor" stroke="none" fontWeight="bold">2</text>
          <text x="2" y="20" fontSize="8" fill="currentColor" stroke="none" fontWeight="bold">3</text>
        </svg>
      </button>
      <button
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={btnClass(editor.isActive("blockquote"))}
        title="Alinti"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z" />
          <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" />
        </svg>
      </button>

      {divider}

      {/* Text alignment */}
      <button
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        className={btnClass(editor.isActive({ textAlign: "left" }))}
        title="Sola Hizala"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="15" y2="12" />
          <line x1="3" y1="18" x2="18" y2="18" />
        </svg>
      </button>
      <button
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        className={btnClass(editor.isActive({ textAlign: "center" }))}
        title="Ortala"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="6" y1="12" x2="18" y2="12" />
          <line x1="4" y1="18" x2="20" y2="18" />
        </svg>
      </button>
      <button
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        className={btnClass(editor.isActive({ textAlign: "right" }))}
        title="Saga Hizala"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="9" y1="12" x2="21" y2="12" />
          <line x1="6" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {divider}

      {/* Table */}
      <button
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        className={btnClass(false)}
        title="Tablo Ekle"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="3" y1="15" x2="21" y2="15" />
          <line x1="9" y1="3" x2="9" y2="21" />
          <line x1="15" y1="3" x2="15" y2="21" />
        </svg>
      </button>

      {editor.isActive("table") && (
        <>
          <button
            onClick={() => editor.chain().focus().addColumnAfter().run()}
            className={btnClass(false)}
            title="Sutun Ekle"
          >
            <span className="text-[10px] font-medium w-4 h-4 flex items-center justify-center">+C</span>
          </button>
          <button
            onClick={() => editor.chain().focus().addRowAfter().run()}
            className={btnClass(false)}
            title="Satir Ekle"
          >
            <span className="text-[10px] font-medium w-4 h-4 flex items-center justify-center">+R</span>
          </button>
          <button
            onClick={() => editor.chain().focus().deleteColumn().run()}
            className="p-1.5 rounded text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
            title="Sutun Sil"
          >
            <span className="text-[10px] font-medium w-4 h-4 flex items-center justify-center">-C</span>
          </button>
          <button
            onClick={() => editor.chain().focus().deleteRow().run()}
            className="p-1.5 rounded text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
            title="Satir Sil"
          >
            <span className="text-[10px] font-medium w-4 h-4 flex items-center justify-center">-R</span>
          </button>
          <button
            onClick={() => editor.chain().focus().deleteTable().run()}
            className="p-1.5 rounded text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
            title="Tabloyu Sil"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M3 6h18" />
              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
              <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
          </button>
        </>
      )}

      {divider}

      {/* Horizontal rule */}
      <button
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        className={btnClass(false)}
        title="Yatay Cizgi"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <line x1="3" y1="12" x2="21" y2="12" />
        </svg>
      </button>

      {/* Undo / Redo */}
      <button
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        className={`p-1.5 rounded transition-colors ${
          editor.can().undo() ? "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700" : "text-zinc-300"
        }`}
        title="Geri Al"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M3 7v6h6" />
          <path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13" />
        </svg>
      </button>
      <button
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        className={`p-1.5 rounded transition-colors ${
          editor.can().redo() ? "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700" : "text-zinc-300"
        }`}
        title="Ileri Al"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M21 7v6h-6" />
          <path d="M3 17a9 9 0 019-9 9 9 0 016 2.3L21 13" />
        </svg>
      </button>
    </div>
  );
}
