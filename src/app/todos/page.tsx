"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type ColumnId = "cinar" | "mert" | "kaan";

type Todo = { id: string; text: string; done: boolean; column: string };

const COLUMNS: { id: ColumnId; title: string }[] = [
  { id: "cinar", title: "Çınar" },
  { id: "mert", title: "Mert" },
  { id: "kaan", title: "Kaan" },
];

export default function TodosPage() {
  const [byColumn, setByColumn] = useState<Record<ColumnId, Todo[]>>({
    cinar: [],
    mert: [],
    kaan: [],
  });
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<ColumnId, string>>({
    cinar: "",
    mert: "",
    kaan: "",
  });

  const fetchTodos = useCallback(async () => {
    try {
      const res = await fetch("/api/todos");
      if (!res.ok) return;
      const data = await res.json();
      const todos = data.todos || {};
      setByColumn({
        cinar: todos.cinar || [],
        mert: todos.mert || [],
        kaan: todos.kaan || [],
      });
    } catch (err) {
      console.error("Failed to fetch todos:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  async function addTodo(columnId: ColumnId) {
    const text = drafts[columnId].trim();
    if (!text) return;

    setDrafts((d) => ({ ...d, [columnId]: "" }));

    try {
      const res = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ column: columnId, text }),
      });
      if (res.ok) {
        const todo = await res.json();
        setByColumn((prev) => ({
          ...prev,
          [columnId]: [...prev[columnId], todo],
        }));
      }
    } catch (err) {
      console.error("Failed to add todo:", err);
    }
  }

  const toggleTodo = useCallback(async (columnId: ColumnId, todoId: string) => {
    setByColumn((prev) => ({
      ...prev,
      [columnId]: prev[columnId].map((t) =>
        t.id === todoId ? { ...t, done: !t.done } : t
      ),
    }));

    const todo = byColumn[columnId]?.find((t) => t.id === todoId);
    if (!todo) return;

    try {
      await fetch(`/api/todos/${todoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: !todo.done }),
      });
    } catch (err) {
      console.error("Failed to toggle todo:", err);
      fetchTodos();
    }
  }, [byColumn, fetchTodos]);

  const removeTodo = useCallback(async (columnId: ColumnId, todoId: string) => {
    setByColumn((prev) => ({
      ...prev,
      [columnId]: prev[columnId].filter((t) => t.id !== todoId),
    }));

    try {
      await fetch(`/api/todos/${todoId}`, { method: "DELETE" });
    } catch (err) {
      console.error("Failed to remove todo:", err);
      fetchTodos();
    }
  }, [fetchTodos]);

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Takım görevleri</h2>
        <p className="text-zinc-500 mt-1 text-sm">
          Her kişi için ayrı kolon; madde ekleyip tamamlayabilir veya silebilirsiniz.
        </p>
      </div>

      {loading ? (
        <div className="text-center text-zinc-400 py-12">Yükleniyor...</div>
      ) : (
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
      )}
    </div>
  );
}
