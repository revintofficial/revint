"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Settings, CreditCard, Building2, User as UserIcon } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase/browser";
import { toast } from "sonner";

export interface UserMenuProps {
  user: { email: string; fullName: string | null; avatarUrl: string | null };
  workspace: { name: string; plan: "FREE" | "PRO" | "PRO_TEAM" | "AGENCY" };
  role: "OWNER" | "ADMIN" | "MEMBER";
  collapsed?: boolean;
}

const PLAN_BADGE: Record<UserMenuProps["workspace"]["plan"], { label: string; color: string }> = {
  FREE: { label: "Free", color: "hsl(var(--leadac-h) var(--leadac-nts) 92% / 0.55)" },
  PRO: { label: "Pro Solo", color: "var(--leadac-500)" },
  PRO_TEAM: { label: "Pro Team", color: "var(--leadac-500)" },
  AGENCY: { label: "Agency", color: "var(--leadac-400)" },
};

function initials(nameOrEmail: string) {
  const parts = nameOrEmail.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] || "?") + (parts[1]?.[0] || "")).toUpperCase();
}

export function UserMenu({ user, workspace, role, collapsed }: UserMenuProps) {
  const router = useRouter();
  const supabase = createSupabaseBrowser();
  const display = user.fullName || user.email;
  const planBadge = PLAN_BADGE[workspace.plan];

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Sign out failed");
      return;
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`flex items-center gap-2.5 w-full px-2 py-1.5 rounded-lg hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--leadac-500) ${collapsed ? "md:justify-center md:px-1" : ""}`}
          aria-label="Open account menu"
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0"
            style={{ background: "linear-gradient(135deg, hsl(var(--leadac-h) var(--leadac-s) 50%), hsl(var(--leadac-h) var(--leadac-s) 42%))" }}
          >
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt=""
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              initials(display)
            )}
          </div>
          <div className={`flex-1 min-w-0 text-left ${collapsed ? "md:hidden" : ""}`}>
            <p className="text-[12.5px] font-medium truncate text-white">{display}</p>
            <p className="text-[10.5px] truncate" style={{ color: planBadge.color }}>
              {planBadge.label} {role === "OWNER" ? "· Owner" : role === "ADMIN" ? "· Admin" : ""}
            </p>
          </div>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        side="top"
        className="w-56"
        sideOffset={8}
      >
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-[13px] font-medium leading-none truncate">{display}</p>
            <p className="text-[11px] leading-none text-white/50 truncate">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/app/settings/account" className="cursor-pointer">
            <UserIcon className="w-3.5 h-3.5 mr-2" />
            Account
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/app/settings/workspace" className="cursor-pointer">
            <Building2 className="w-3.5 h-3.5 mr-2" />
            Workspace
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/app/settings/billing" className="cursor-pointer">
            <CreditCard className="w-3.5 h-3.5 mr-2" />
            Billing
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/app/settings" className="cursor-pointer">
            <Settings className="w-3.5 h-3.5 mr-2" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut} className="cursor-pointer text-[hsl(4_62%_54%)]">
          <LogOut className="w-3.5 h-3.5 mr-2" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
