/**
 * P0.5 - Social profile icon row.
 *
 * Renders the 8 platform icons in lead detail. Each icon is a clickable link
 * if the scraper found a profile, otherwise rendered greyed-out as "not found".
 * Pulls from /api/leads/[id] which now includes websiteAudit.socialProfiles.
 */

"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";

// lucide-react@1.8.0 (codebase'de pinned) brand iconlar export etmiyor.
// SVG path'leri Simple Icons (CC0) kaynağından alındı, normalize edildi.
function Icon({ d, ...props }: { d: string } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      width="14"
      height="14"
      {...props}
    >
      <path d={d} />
    </svg>
  );
}

const Instagram = (p: React.SVGProps<SVGSVGElement>) => (
  <Icon d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849s-.012 3.584-.069 4.849c-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919C8.416 2.175 8.796 2.163 12 2.163zm0-2.163C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" {...p} />
);

const Facebook = (p: React.SVGProps<SVGSVGElement>) => (
  <Icon d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 011.141.195v3.325a8.623 8.623 0 00-.653-.036 26.805 26.805 0 00-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 00-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z" {...p} />
);

const Linkedin = (p: React.SVGProps<SVGSVGElement>) => (
  <Icon d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" {...p} />
);

const Youtube = (p: React.SVGProps<SVGSVGElement>) => (
  <Icon d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" {...p} />
);

const Twitter = (p: React.SVGProps<SVGSVGElement>) => (
  <Icon d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" {...p} />
);

interface SocialProfiles {
  instagram: string | null;
  facebook: string | null;
  linkedin: string | null;
  tiktok: string | null;
  youtube: string | null;
  twitter: string | null;
  whatsapp: string | null;
  pinterest: string | null;
}

const ICON_MAP = [
  { key: "instagram", label: "Instagram", Icon: Instagram, color: "#E1306C" },
  { key: "facebook", label: "Facebook", Icon: Facebook, color: "#1877F2" },
  { key: "linkedin", label: "LinkedIn", Icon: Linkedin, color: "#0A66C2" },
  { key: "youtube", label: "YouTube", Icon: Youtube, color: "#FF0000" },
  { key: "twitter", label: "X (Twitter)", Icon: Twitter, color: "#000000" },
] as const;

export function SocialProfileIcons({ leadId }: { leadId: string }) {
  const [profiles, setProfiles] = useState<SocialProfiles | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/leads/${leadId}`)
      .then((r) => r.json())
      .then((data) => {
        const audit = data.websiteAudit;
        if (audit?.socialProfiles) {
          setProfiles(audit.socialProfiles as SocialProfiles);
        } else {
          setProfiles(null);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [leadId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Social profiles</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-white/40">Yükleniyor...</p>
        </CardContent>
      </Card>
    );
  }

  if (!profiles) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Social profiles</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-white/50">
            Önce siteyi crawl et. Crawl sonrası 8 platform için profil scraping yapılır.
          </p>
        </CardContent>
      </Card>
    );
  }

  const found = ICON_MAP.filter((m) => profiles[m.key as keyof SocialProfiles]);
  const missing = ICON_MAP.filter((m) => !profiles[m.key as keyof SocialProfiles]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">Social profiles</CardTitle>
      </CardHeader>
      <CardContent>
        {found.length === 0 ? (
          <p className="text-sm text-white/50">
            Bu işletmenin sitesinde sosyal profil linki bulunamadı.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2 mb-4">
            {found.map(({ key, label, Icon, color }) => {
              const url = profiles[key as keyof SocialProfiles];
              if (!url) return null;
              return (
                <a
                  key={key}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-white/10"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "0.5px solid rgba(255,255,255,0.1)",
                    color,
                  }}
                  title={url}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                  <ExternalLink className="w-3 h-3 opacity-50" />
                </a>
              );
            })}
          </div>
        )}
        {profiles.whatsapp && (
          <a
            href={profiles.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-[#25D366]/20"
            style={{
              background: "rgba(37,211,102,0.12)",
              border: "0.5px solid rgba(37,211,102,0.3)",
              color: "#25D366",
            }}
          >
            WhatsApp <ExternalLink className="w-3 h-3 opacity-50" />
          </a>
        )}
        {missing.length > 0 && (
          <p className="text-xs text-white/30 mt-3">
            Bulunmayan: {missing.map((m) => m.label).join(", ")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
