import {
  Award,
  Bot,
  Brain,
  Building2,
  Clock,
  GitBranch,
  Globe,
  Inbox,
  LayoutGrid,
  Leaf,
  Mailbox,
  MessageSquare,
  Package,
  PhoneCall,
  Scale,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Truck,
  Wand2,
  Warehouse,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * String → LucideIcon lookup so server components can describe section
 * content with plain strings (otherwise Next refuses to serialise icon
 * function components across the server→client boundary).
 *
 * Add new icons here as sections need them — keep alphabetical.
 */
export const CINE_ICON_MAP = {
  Award,
  Bot,
  Brain,
  Building2,
  Clock,
  GitBranch,
  Globe,
  Inbox,
  LayoutGrid,
  Leaf,
  Mailbox,
  MessageSquare,
  Package,
  PhoneCall,
  Scale,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Truck,
  Wand2,
  Warehouse,
  Zap,
} as const satisfies Record<string, LucideIcon>;

export type CineIconName = keyof typeof CINE_ICON_MAP;

export function resolveCineIcon(name: CineIconName): LucideIcon {
  return CINE_ICON_MAP[name];
}
