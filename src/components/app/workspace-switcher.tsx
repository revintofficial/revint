"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Building2,
  Check,
  ChevronsUpDown,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Plan = "FREE" | "PRO" | "PRO_TEAM" | "AGENCY";
type Role = "OWNER" | "ADMIN" | "MEMBER";

interface WorkspaceListItem {
  id: string;
  name: string;
  slug: string;
  plan: Plan;
  role: Role;
}

interface WorkspaceSwitcherProps {
  current: { id: string; name: string; slug: string; plan: Plan };
  role: Role;
  collapsed?: boolean;
}

const PLAN_LABEL: Record<Plan, string> = {
  FREE: "Free",
  PRO: "Pro",
  PRO_TEAM: "Pro Team",
  AGENCY: "Agency",
};

export function WorkspaceSwitcher({ current, role, collapsed }: WorkspaceSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceListItem[] | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<WorkspaceListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [switchingId, setSwitchingId] = useState<string | null>(null);

  async function loadWorkspaces() {
    setLoadingList(true);
    try {
      const res = await fetch("/api/workspaces", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to load workspaces");
        return;
      }
      setWorkspaces(data.workspaces as WorkspaceListItem[]);
    } catch {
      toast.error("Failed to load workspaces");
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    if (open && workspaces === null) {
      loadWorkspaces();
    }
  }, [open, workspaces]);

  async function switchTo(ws: WorkspaceListItem) {
    if (ws.id === current.id) {
      setOpen(false);
      return;
    }
    setSwitchingId(ws.id);
    try {
      const res = await fetch("/api/workspaces/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: ws.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to switch workspace");
        return;
      }
      toast.success(`Switched to ${ws.name}`);
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Failed to switch workspace");
    } finally {
      setSwitchingId(null);
    }
  }

  async function createWorkspace(e: React.FormEvent) {
    e.preventDefault();
    const name = createName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to create workspace");
        return;
      }
      toast.success(`Workspace "${data.name}" created`);
      setCreateOpen(false);
      setCreateName("");
      setWorkspaces(null);
      router.refresh();
    } catch {
      toast.error("Failed to create workspace");
    } finally {
      setCreating(false);
    }
  }

  async function deleteWorkspace() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/workspaces/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Failed to delete workspace");
        return;
      }
      toast.success(`Workspace "${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
      setWorkspaces(null);
      router.refresh();
    } catch {
      toast.error("Failed to delete workspace");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            className={`group flex items-center gap-1.5 min-w-0 rounded-md px-1.5 py-1 -mx-1.5 hover:bg-white/5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0A84FF] ${
              collapsed ? "md:hidden" : ""
            }`}
            aria-label="Switch workspace"
          >
            <span
              className="text-[11px] truncate"
              style={{ color: "rgba(235, 235, 245, 0.55)" }}
            >
              {current.name}
            </span>
            <ChevronsUpDown
              className="w-3 h-3 shrink-0 opacity-60 group-hover:opacity-100"
              style={{ color: "rgba(235, 235, 245, 0.55)" }}
              aria-hidden="true"
            />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" side="bottom" sideOffset={6} className="w-64">
          <DropdownMenuLabel className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider text-white/50 font-semibold">
              Workspaces
            </span>
            {role === "OWNER" && (
              <span className="text-[10px] text-white/40">Owner</span>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {loadingList && !workspaces && (
            <div className="flex items-center gap-2 px-2 py-2 text-[12.5px] text-white/60">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading…
            </div>
          )}

          {workspaces?.map((ws) => {
            const isActive = ws.id === current.id;
            const isSwitching = switchingId === ws.id;
            const canDelete = ws.role === "OWNER" && workspaces.length > 1;
            return (
              <DropdownMenuItem
                key={ws.id}
                onSelect={(e) => {
                  e.preventDefault();
                  switchTo(ws);
                }}
                className="cursor-pointer flex items-center gap-2"
              >
                <Building2
                  className="w-3.5 h-3.5 shrink-0"
                  style={{ color: isActive ? "#0A84FF" : "rgba(235,235,245,0.55)" }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium truncate text-white">{ws.name}</p>
                  <p className="text-[10.5px] truncate text-white/50">
                    {PLAN_LABEL[ws.plan]} · {ws.role.toLowerCase()}
                  </p>
                </div>
                {isSwitching ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-white/60" />
                ) : isActive ? (
                  <Check className="w-3.5 h-3.5 text-[#0A84FF]" />
                ) : canDelete ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setOpen(false);
                      setDeleteTarget(ws);
                    }}
                    className="rounded p-0.5 hover:bg-white/10 text-white/50 hover:text-[#FF453A]"
                    aria-label={`Delete ${ws.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                ) : null}
              </DropdownMenuItem>
            );
          })}

          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setOpen(false);
              setCreateOpen(true);
            }}
            className="cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 mr-2" />
            Create workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create workspace</DialogTitle>
            <DialogDescription>
              A new workspace has its own leads, campaigns, and billing.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={createWorkspace} className="space-y-3">
            <div>
              <label className="block text-[11.5px] text-white/55 mb-1">Name</label>
              <Input
                autoFocus
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Acme Agency"
                maxLength={60}
                disabled={creating}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCreateOpen(false)}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creating || !createName.trim()}>
                {creating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Creating…
                  </>
                ) : (
                  "Create"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && !deleting && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete workspace?</DialogTitle>
            <DialogDescription>
              {deleteTarget && (
                <>
                  <span className="text-white">&quot;{deleteTarget.name}&quot;</span>{" "}
                  and all of its leads, campaigns, and billing data will be
                  permanently removed. This cannot be undone.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={deleteWorkspace}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Deleting…
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
