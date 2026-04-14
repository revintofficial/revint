"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, CheckSquare } from "lucide-react";

type ColumnId = "cinar" | "mert" | "kaan";

type Todo = { id: string; text: string; done: boolean; column: string };

const COLUMNS: { id: ColumnId; title: string; gradient: string }[] = [
  { id: "cinar", title: "Çınar", gradient: "from-indigo-500 to-violet-500" },
  { id: "mert", title: "Mert", gradient: "from-emerald-500 to-teal-500" },
  { id: "kaan", title: "Kaan", gradient: "from-amber-500 to-orange-500" },
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
    <div className="p-6 md:p-8 lg:p-10 space-y-6">
      <PageHeader
        title="Takım Görevleri"
        subtitle="Her kişi için ayrı kolon; madde ekleyip tamamlayabilir veya silebilirsiniz."
      />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 items-start">
          {COLUMNS.map((col, colIndex) => {
            const doneCount = byColumn[col.id].filter((t) => t.done).length;
            const totalCount = byColumn[col.id].length;

            return (
              <Card
                key={col.id}
                className="flex flex-col min-h-[280px] animate-fade-in-up"
                style={{ animationDelay: `${colIndex * 100}ms` }}
              >
                <div className={`h-1 rounded-t-xl bg-gradient-to-r ${col.gradient}`} />
                <CardHeader className="pb-3 border-b border-slate-200/60">
                  <div className="flex items-center justify-between">
                    <CardTitle>{col.title}</CardTitle>
                    {totalCount > 0 && (
                      <span className="text-xs text-slate-400">{doneCount}/{totalCount}</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col flex-1 gap-3 pt-4">
                  <div className="flex gap-2">
                    <Input
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
                      aria-label={`${col.title} için yeni görev`}
                    />
                    <Button type="button" size="icon" variant="gradient" onClick={() => addTodo(col.id)}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>

                  <ul className="flex flex-col gap-2 flex-1">
                    {byColumn[col.id].length === 0 && (
                      <li className="text-sm text-slate-400 py-8 text-center rounded-xl border border-dashed border-slate-200/60">
                        <CheckSquare className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                        Henüz görev yok
                      </li>
                    )}
                    {byColumn[col.id].map((todo, todoIndex) => (
                      <li
                        key={todo.id}
                        className="flex items-start gap-2 rounded-xl border border-slate-200/40 bg-white/50 backdrop-blur-sm p-3 hover:shadow-sm transition-all animate-fade-in-up"
                        style={{ animationDelay: `${todoIndex * 50}ms` }}
                      >
                        <label className="flex items-start gap-2.5 flex-1 min-w-0 cursor-pointer">
                          <div className="relative mt-0.5">
                            <input
                              type="checkbox"
                              checked={todo.done}
                              onChange={() => toggleTodo(col.id, todo.id)}
                              className="peer h-4 w-4 rounded border-slate-300 text-indigo-500 focus:ring-indigo-500/40 transition-all"
                            />
                          </div>
                          <span
                            className={`text-sm break-words transition-all duration-200 ${
                              todo.done ? "text-slate-400 line-through" : "text-slate-700"
                            }`}
                          >
                            {todo.text}
                          </span>
                        </label>
                        <button
                          type="button"
                          onClick={() => removeTodo(col.id, todo.id)}
                          className="shrink-0 rounded-lg p-1 text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                          style={{ opacity: 1 }}
                          aria-label="Görevi sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
