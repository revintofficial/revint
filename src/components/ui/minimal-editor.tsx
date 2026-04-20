"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Bold, List, ListChecks } from "lucide-react";
import { useEffect } from "react";

// Stripped-down note editor for the Deals kanban side panel. Intentionally
// missing: tables, text color, highlight, alignment, headings, underline,
// strike, blockquote, horizontal rule, undo/redo buttons. Salespeople writing
// "called Tuesday, callback Friday" don't need any of that.
export function MinimalEditor({
  initialContent,
  onUpdate,
  placeholder,
}: {
  initialContent: string;
  onUpdate: (html: string) => void;
  placeholder?: string;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        horizontalRule: false,
        codeBlock: false,
      }),
      TaskList,
      TaskItem.configure({ nested: false }),
    ],
    content: initialContent,
    onUpdate: ({ editor }) => {
      onUpdate(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm prose-invert max-w-none focus:outline-none min-h-[140px] p-3 text-white/80",
        "data-placeholder": placeholder ?? "",
      },
    },
  });

  // Resync external changes (e.g. a different card selected) into the editor.
  useEffect(() => {
    if (!editor) return;
    if ((initialContent || "") !== editor.getHTML()) {
      editor.commands.setContent(initialContent || "", { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialContent, editor]);

  if (!editor) return null;

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden bg-white/5">
      <MinimalToolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

function MinimalToolbar({ editor }: { editor: Editor }) {
  const btn = (active: boolean) =>
    `p-1.5 rounded-md transition-colors ${
      active ? "bg-[#0A84FF]/15 text-[#0A84FF]" : "text-white/50 hover:bg-white/10 hover:text-white/80"
    }`;

  return (
    <div className="flex items-center gap-1 p-1.5 bg-white/5 border-b border-white/10">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={btn(editor.isActive("bold"))}
        title="Bold"
        aria-label="Bold"
      >
        <Bold className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={btn(editor.isActive("bulletList"))}
        title="Bullet list"
        aria-label="Bullet list"
      >
        <List className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        className={btn(editor.isActive("taskList"))}
        title="Task list"
        aria-label="Task list"
      >
        <ListChecks className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
