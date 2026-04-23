export interface DemoLead {
  name: string;
  city: string;
  phone: string;
  website: string | null;
  rating: number;
  reviewCount: number;
  score: number;
  issues: string[];
  pitch: string;
  signals?: DemoAuditSignal[];
  services?: string[];
  brandColor?: string;
}

export interface DemoAuditSignal {
  label: string;
  status: "good" | "bad" | "warning";
  detail: string;
}

export function scoreColor(s: number) {
  if (s >= 85) return "#FB7185";
  if (s >= 70) return "#F59E0B";
  return "#8B5CF6";
}

export const DEFAULT_SIGNALS: DemoAuditSignal[] = [
  { label: "HTTPS", status: "bad", detail: "Site served over HTTP only" },
  { label: "Mobile fit", status: "bad", detail: "Viewport not configured" },
  { label: "Booking flow", status: "bad", detail: "No booking or contact form" },
  { label: "Page speed", status: "warning", detail: "5.2s on mobile 4G" },
  { label: "Last updated", status: "warning", detail: "© 2019 in footer" },
];
