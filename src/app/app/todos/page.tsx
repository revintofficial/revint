"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, CheckSquare, X } from "lucide-react";

type Todo = { id: string; text: string; done: boolean; column: string };

const ACCENT_COLORS = [
  "var(--leadac-500)",
  "var(--leadac-success)",
  "var(--leadac-warning)",
  "var(--leadac-error)",
  "var(--leadac-300)",
];

const STORAGE_KEY = "todo-columns";

function getSavedColumns(): string[] {
  if (typeof window === "undefined") return ["Team"];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : ["Team"];
  } catch {
    return ["Team"];
  }
}

export default function TodosPage() {
  const [columns, setColumns] = useState<string[]>(getSavedColumns);
  const [byColumn, setByColumn] = useState<Record<string, Todo[]>>({});
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [newColumnName, setNewColumnName] = useState("");
  const [showAddColumn, setShowAddColumn] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(columns));
  }, [columns]);

  const fetchTodos = useCallback(async () => {
    try {
      const res = await fetch("/api/todos");
      if (!res.ok) return;
      const data = await res.json();
      const todos: Record<string, Todo[]> = data.todos || {};

      setColumns((prev) => {
        const existing = new Set(prev.map((c) => c.toLowerCase()));
        const newCols = [...prev];
        for (const key of Object.keys(todos)) {
          if (!existing.has(key)) {
            existing.add(key);
            newCols.push(key.charAt(0).toUpperCase() + key.slice(1));
          }
        }
        return newCols;
      });

      setByColumn(todos);
    } catch (err) {
      console.error("Failed to fetch todos:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  const addColumn = () => {
    const name = newColumnName.trim();
    if (!name || columns.find((c) => c.toLowerCase() === name.toLowerCase())) return;
    setColumns((prev) => [...prev, name]);
    setByColumn((prev) => ({ ...prev, [name.toLowerCase()]: [] }));
    setNewColumnName("");
    setShowAddColumn(false);
  };

  const removeColumn = (colName: string) => {
    const key = colName.toLowerCase();
    const todos = byColumn[key] || [];
    if (todos.length > 0) {
      if (!confirm(`Remove "${colName}" and its ${todos.length} task(s)?`)) return;
      for (const todo of todos) {
        fetch(`/api/todos/${todo.id}`, { method: "DELETE" }).catch(console.error);
      }
    }
    setColumns((prev) => prev.filter((c) => c !== colName));
    setByColumn((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  async function addTodo(columnKey: string) {
    const text = (drafts[columnKey] || "").trim();
    if (!text) return;
    setDrafts((d) => ({ ...d, [columnKey]: "" }));
    try {
      const res = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ column: columnKey, text }),
      });
      if (res.ok) {
        const todo = await res.json();
        setByColumn((prev) => ({
          ...prev,
          [columnKey]: [...(prev[columnKey] || []), todo],
        }));
      }
    } catch (err) {
      console.error("Failed to add todo:", err);
    }
  }

  const toggleTodo = useCallback(async (columnKey: string, todoId: string) => {
    setByColumn((prev) => ({
      ...prev,
      [columnKey]: (prev[columnKey] || []).map((t) =>
        t.id === todoId ? { ...t, done: !t.done } : t
      ),
    }));
    const todo = byColumn[columnKey]?.find((t) => t.id === todoId);
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

  const removeTodo = useCallback(async (columnKey: string, todoId: string) => {
    setByColumn((prev) => ({
      ...prev,
      [columnKey]: (prev[columnKey] || []).filter((t) => t.id !== todoId),
    }));
    try {
      await fetch(`/api/todos/${todoId}`, { method: "DELETE" });
    } catch (err) {
      console.error("Failed to remove todo:", err);
      fetchTodos();
    }
  }, [fetchTodos]);

  return (
    <div className="p-4 sm:p-6 md:p-8 lg:p-10 space-y-6">
      <PageHeader
        title="Tasks"
        subtitle="Organize your team's to-do lists by person or category"
        actions={
          showAddColumn ? (
            <div className="flex items-center gap-2">
              <Input
                type="text"
                placeholder="Column name"
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addColumn(); }}
                className="w-40"
                autoFocus
              />
              <Button size="sm" onClick={addColumn} disabled={!newColumnName.trim()}>
                Add
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAddColumn(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setShowAddColumn(true)}>
              <Plus className="w-4 h-4" />
              Add Column
            </Button>
          )
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
        </div>
      ) : (
        <div className={`grid grid-cols-1 gap-4 md:gap-6 items-start ${
          columns.length === 1 ? "md:grid-cols-1 max-w-md" :
          columns.length === 2 ? "md:grid-cols-2" :
          columns.length >= 3 ? "md:grid-cols-3" : ""
        }`}>
          {columns.map((colName, colIndex) => {
            const key = colName.toLowerCase();
            const todos = byColumn[key] || [];
            const doneCount = todos.filter((t) => t.done).length;
            const totalCount = todos.length;
            const accentColor = ACCENT_COLORS[colIndex % ACCENT_COLORS.length];

            return (
              <Card
                key={colName}
                className="flex flex-col min-h-[280px] animate-fade-in-up"
                style={{ animationDelay: `${colIndex * 100}ms` }}
              >
                <div className="h-1 rounded-t-2xl" style={{ backgroundColor: accentColor }} />
                <CardHeader className="pb-3 border-b border-white/10">
                  <div className="flex items-center justify-between">
                    <CardTitle>{colName}</CardTitle>
                    <div className="flex items-center gap-2">
                      {totalCount > 0 && (
                        <span className="text-xs text-white/30">{doneCount}/{totalCount}</span>
                      )}
                      {columns.length > 1 && (
                        <button
                          onClick={() => removeColumn(colName)}
                          className="text-white/20 hover:text-[hsl(4_62%_54%)] transition-colors rounded p-0.5"
                          title={`Remove ${colName} column`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col flex-1 gap-3 pt-4">
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={drafts[key] || ""}
                      onChange={(e) =>
                        setDrafts((d) => ({ ...d, [key]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addTodo(key);
                        }
                      }}
                      placeholder="New task..."
                      aria-label={`New task for ${colName}`}
                    />
                    <Button type="button" size="icon" onClick={() => addTodo(key)}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>

                  <ul className="flex flex-col gap-2 flex-1">
                    {todos.length === 0 && (
                      <li className="text-sm text-white/30 py-8 text-center rounded-xl border border-dashed border-white/10">
                        <CheckSquare className="w-8 h-8 text-white/20 mx-auto mb-2" />
                        No tasks yet
                      </li>
                    )}
                    {todos.map((todo, todoIndex) => (
                      <li
                        key={todo.id}
                        className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 p-3 hover:shadow-sm transition-shadow animate-fade-in-up group"
                        style={{ animationDelay: `${todoIndex * 50}ms` }}
                      >
                        <label className="flex items-start gap-2.5 flex-1 min-w-0 cursor-pointer">
                          <div className="relative mt-0.5">
                            <input
                              type="checkbox"
                              checked={todo.done}
                              onChange={() => toggleTodo(key, todo.id)}
                              className="peer h-4 w-4 rounded border-[hsl(var(--leadac-h) var(--leadac-ns) 35% / 0.35)] text-(--leadac-500) focus:ring-(--leadac-500)/40 transition-all"
                            />
                          </div>
                          <span
                            className={`text-sm break-words transition-all duration-200 ${
                              todo.done ? "text-white/30 line-through" : "text-white/70"
                            }`}
                          >
                            {todo.text}
                          </span>
                        </label>
                        <button
                          type="button"
                          onClick={() => removeTodo(key, todo.id)}
                          className="shrink-0 rounded-lg p-1 text-white/20 hover:bg-[hsl(4_62%_54%)]/10 hover:text-[hsl(4_62%_54%)] transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                          aria-label="Delete task"
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
