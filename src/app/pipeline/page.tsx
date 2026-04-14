"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Loader2,
  GitBranch,
  ChevronRight,
  ExternalLink,
  Phone,
  MapPin,
  Star,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Quote,
  Minus,
  Highlighter,
  Undo2,
  Redo2,
  Table as TableIcon,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Columns,
  Rows,
  Merge,
} from "lucide-react";

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
    { value: "ALL", label: "Tumu", count: items.length, activeColor: "bg-white text-slate-900 shadow-sm" },
    { value: "PENDING", label: "Bekleyen", count: pendingCount, activeColor: "bg-white text-slate-900 shadow-sm" },
    { value: "IN_PROGRESS", label: "Devam Ediyor", count: inProgressCount, activeColor: "bg-white text-slate-900 shadow-sm" },
    { value: "POSITIVE", label: "Olumlu", count: positiveCount, activeColor: "bg-white text-slate-900 shadow-sm" },
    { value: "NEGATIVE", label: "Olumsuz", count: negativeCount, activeColor: "bg-white text-slate-900 shadow-sm" },
  ];

  return (
    <div className="p-6 md:p-8 lg:p-10 space-y-6">
      <PageHeader
        title="Sales Pipeline"
        subtitle={loading ? "Yukleniyor..." : `${items.length} dukkan pipeline'da`}
      />

      {!loading && items.length > 0 && (
        <div className="flex items-center gap-1 p-1 bg-slate-100/80 backdrop-blur-sm rounded-xl w-fit max-w-full overflow-x-auto">
          {STAGE_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStageFilter(tab.value)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                stageFilter === tab.value
                  ? tab.activeColor
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
              }`}
            >
              {tab.label}
              <span
                className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                  stageFilter === tab.value ? "bg-slate-100/80" : "bg-slate-200 text-slate-500"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="rounded-xl">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-64" />
                    <div className="flex gap-2">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-[200px] w-full rounded-xl" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && items.length === 0 && (
        <Card className="rounded-xl">
          <CardContent className="py-12">
            <div className="text-center text-slate-400">
              <p className="text-lg font-medium">Pipeline bos</p>
              <p className="text-sm mt-1">
                Watchlist&apos;e lead ekleyerek pipeline&apos;a dukkan ekleyebilirsiniz.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && items.length > 0 && filteredItems.length === 0 && (
        <Card className="rounded-xl">
          <CardContent className="py-12">
            <div className="text-center text-slate-400">
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
        ? { label: "Olumsuz", cls: "bg-rose-100 text-rose-700 border-rose-200" }
        : null;

  return (
    <Card className="rounded-xl hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="text-base sm:text-lg">
              <Link href={`/leads/${item.lead.id}`} className="hover:underline">
                {item.lead.businessName}
              </Link>
            </CardTitle>
            <p className="text-sm text-slate-500 mt-0.5 truncate">{item.lead.formattedAddress}</p>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              {item.lead.phone && (
                <span className="text-xs text-slate-500">{item.lead.phone}</span>
              )}
              {item.lead.websiteUrl && (
                <Link
                  href={item.lead.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-indigo-600 hover:underline truncate max-w-[200px]"
                >
                  {item.lead.websiteUrl}
                </Link>
              )}
              {item.siteUrl && (
                <Link
                  href={item.siteUrl.startsWith("http") ? item.siteUrl : `https://${item.siteUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-emerald-600 hover:underline"
                >
                  Yapilan Site
                </Link>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0">
            {saving && <span className="text-xs text-slate-400 animate-pulse">Kaydediliyor...</span>}
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
    <div className="border border-slate-200/60 rounded-xl overflow-hidden bg-white">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;

  const btnClass = (active: boolean) =>
    `p-1.5 rounded-lg transition-colors ${
      active ? "bg-indigo-50 text-indigo-600" : "text-slate-500 hover:bg-slate-100/80 hover:text-slate-700"
    }`;

  const divider = <div className="w-px h-6 bg-slate-200/60 mx-1" />;

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 rounded-xl bg-white/70 backdrop-blur-sm border border-slate-200/60 mb-3">
      {/* Text formatting */}
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={btnClass(editor.isActive("bold"))}
        title="Kalin"
      >
        <Bold className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={btnClass(editor.isActive("italic"))}
        title="Italik"
      >
        <Italic className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={btnClass(editor.isActive("underline"))}
        title="Alti Cizili"
      >
        <UnderlineIcon className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={btnClass(editor.isActive("strike"))}
        title="Ustu Cizili"
      >
        <Strikethrough className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHighlight({ color: "#fef08a" }).run()}
        className={btnClass(editor.isActive("highlight"))}
        title="Vurgula"
      >
        <Highlighter className="w-4 h-4" />
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
        <List className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={btnClass(editor.isActive("orderedList"))}
        title="Numarali Liste"
      >
        <ListOrdered className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={btnClass(editor.isActive("blockquote"))}
        title="Alinti"
      >
        <Quote className="w-4 h-4" />
      </button>

      {divider}

      {/* Text alignment */}
      <button
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        className={btnClass(editor.isActive({ textAlign: "left" }))}
        title="Sola Hizala"
      >
        <AlignLeft className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        className={btnClass(editor.isActive({ textAlign: "center" }))}
        title="Ortala"
      >
        <AlignCenter className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        className={btnClass(editor.isActive({ textAlign: "right" }))}
        title="Saga Hizala"
      >
        <AlignRight className="w-4 h-4" />
      </button>

      {divider}

      {/* Table */}
      <button
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        className={btnClass(false)}
        title="Tablo Ekle"
      >
        <TableIcon className="w-4 h-4" />
      </button>

      {editor.isActive("table") && (
        <>
          <button
            onClick={() => editor.chain().focus().addColumnAfter().run()}
            className={btnClass(false)}
            title="Sutun Ekle"
          >
            <Columns className="w-4 h-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().addRowAfter().run()}
            className={btnClass(false)}
            title="Satir Ekle"
          >
            <Rows className="w-4 h-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().deleteColumn().run()}
            className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
            title="Sutun Sil"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().deleteRow().run()}
            className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
            title="Satir Sil"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().deleteTable().run()}
            className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
            title="Tabloyu Sil"
          >
            <Trash2 className="w-4 h-4" />
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
        <Minus className="w-4 h-4" />
      </button>

      {/* Undo / Redo */}
      <button
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        className={`p-1.5 rounded-lg transition-colors ${
          editor.can().undo() ? "text-slate-500 hover:bg-slate-100/80 hover:text-slate-700" : "text-slate-300"
        }`}
        title="Geri Al"
      >
        <Undo2 className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        className={`p-1.5 rounded-lg transition-colors ${
          editor.can().redo() ? "text-slate-500 hover:bg-slate-100/80 hover:text-slate-700" : "text-slate-300"
        }`}
        title="Ileri Al"
      >
        <Redo2 className="w-4 h-4" />
      </button>
    </div>
  );
}
