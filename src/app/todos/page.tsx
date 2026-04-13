"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type ColumnId = "cinar" | "mert" | "kaan";

type Todo = { id: string; text: string; done: boolean };

const COLUMNS: { id: ColumnId; title: string }[] = [
  { id: "cinar", title: "Çınar" },
  { id: "mert", title: "Mert" },
  { id: "kaan", title: "Kaan" },
];

const STORAGE_KEY = "lead-engine-team-todos";

const EMPTY_COLUMNS: Record<ColumnId, Todo[]> = {
  cinar: [],
  mert: [],
  kaan: [],
};

function parseStoredTodos(raw: string | null): Record<ColumnId, Todo[]> | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== "object") return null;
    const o = data as Record<string, unknown>;
    const out: Record<ColumnId, Todo[]> = { ...EMPTY_COLUMNS };
    for (const col of ["cinar", "mert", "kaan"] as const) {
      const arr = o[col];
      if (!Array.isArray(arr)) continue;
      out[col] = arr.filter(
        (item): item is Todo =>
          !!item &&
          typeof item === "object" &&
          typeof (item as Todo).id === "string" &&
          typeof (item as Todo).text === "string" &&
          typeof (item as Todo).done === "boolean"
      );
    }
    return out;
  } catch {
    return null;
  }
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function TodosPage() {
  const [byColumn, setByColumn] = useState<Record<ColumnId, Todo[]>>(EMPTY_COLUMNS);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    const loaded = parseStoredTodos(localStorage.getItem(STORAGE_KEY));
    if (loaded) setByColumn(loaded);
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(byColumn));
    } catch {
      // quota or private mode — ignore
    }
  }, [byColumn, storageReady]);
  const [drafts, setDrafts] = useState<Record<ColumnId, string>>({
    cinar: "",
    mert: "",
    kaan: "",
  });

  function addTodo(columnId: ColumnId) {
    const text = drafts[columnId].trim();
    if (!text) return;
    setByColumn((prev) => ({
      ...prev,
      [columnId]: [...prev[columnId], { id: newId(), text, done: false }],
    }));
    setDrafts((d) => ({ ...d, [columnId]: "" }));
  }

  const toggleTodo = useCallback((columnId: ColumnId, todoId: string) => {
    setByColumn((prev) => ({
      ...prev,
      [columnId]: prev[columnId].map((t) =>
        t.id === todoId ? { ...t, done: !t.done } : t
      ),
    }));
  }, []);

  const removeTodo = useCallback((columnId: ColumnId, todoId: string) => {
    setByColumn((prev) => ({
      ...prev,
      [columnId]: prev[columnId].filter((t) => t.id !== todoId),
    }));
  }, []);

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Takım görevleri</h2>
        <p className="text-zinc-500 mt-1 text-sm">
          Her kişi için ayrı kolon; madde ekleyip tamamlayabilir veya silebilirsiniz.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 items-start">
        {COLUMNS.map((col) => (
          <Card key={col.id} className="flex flex-col min-h-[280px]">
            <CardHeader className="pb-3 border-b border-zinc-100">
              <CardTitle className="text-lg">{col.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col flex-1 gap-3 pt-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={drafts[col.id]}
                  onChange={(e) =>
                    setDrafts((d) => ({ ...d, [col.id]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTodo(col.id);
                    }
                  }}
                  placeholder="Yeni görev..."
                  className="flex-1 h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
                  aria-label={`${col.title} için yeni görev`}
                />
                <Button type="button" size="sm" onClick={() => addTodo(col.id)}>
                  Ekle
                </Button>
              </div>

              <ul className="flex flex-col gap-2 flex-1">
                {byColumn[col.id].length === 0 && (
                  <li className="text-sm text-zinc-400 py-4 text-center rounded-md border border-dashed border-zinc-200">
                    Henüz görev yok
                  </li>
                )}
                {byColumn[col.id].map((todo) => (
                  <li
                    key={todo.id}
                    className="flex items-start gap-2 rounded-md border border-zinc-100 bg-zinc-50/80 p-2.5"
                  >
                    <label className="flex items-start gap-2 flex-1 min-w-0 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={todo.done}
                        onChange={() => toggleTodo(col.id, todo.id)}
                        className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-950"
                      />
                      <span
                        className={`text-sm break-words ${
                          todo.done ? "text-zinc-400 line-through" : "text-zinc-900"
                        }`}
                      >
                        {todo.text}
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => removeTodo(col.id, todo.id)}
                      className="shrink-0 rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      aria-label="Görevi sil"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 6h18" />
                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
                        <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
