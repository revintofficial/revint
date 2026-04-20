/**
 * P0.2 - "My offer" form. Edits the 10 workspace-level offer context fields.
 * Drives both SalesOpportunity and WebsitePlan prompt personalization.
 */

"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Save, Sparkles } from "lucide-react";

interface OfferContext {
  offerName: string | null;
  valueProposition: string | null;
  socialProof: string | null;
  offerHook: string | null;
  objective: string | null;
  tone: string | null;
  length: string | null;
  language: string | null;
  senderName: string | null;
  conversionLink: string | null;
}

const TONE_OPTIONS = ["friendly", "professional", "direct", "casual", "warm"];
const LENGTH_OPTIONS = ["very short", "short", "medium", "long"];
const LANGUAGE_OPTIONS = [
  { value: "tr", label: "Türkçe" },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "de", label: "Deutsch" },
  { value: "fr", label: "Français" },
];
const OBJECTIVE_OPTIONS = [
  "Book a 15-min call",
  "Get a reply",
  "Send the mockup link",
  "Quote a price",
  "Schedule on-site visit",
];

export function OfferForm({ canEdit }: { canEdit: boolean }) {
  const [data, setData] = useState<OfferContext>({
    offerName: "",
    valueProposition: "",
    socialProof: "",
    offerHook: "",
    objective: "",
    tone: "",
    length: "",
    language: "tr",
    senderName: "",
    conversionLink: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/workspace/offer")
      .then((r) => r.json())
      .then((d) =>
        setData({
          offerName: d.offerName ?? "",
          valueProposition: d.valueProposition ?? "",
          socialProof: d.socialProof ?? "",
          offerHook: d.offerHook ?? "",
          objective: d.objective ?? "",
          tone: d.tone ?? "",
          length: d.length ?? "",
          language: d.language ?? "tr",
          senderName: d.senderName ?? "",
          conversionLink: d.conversionLink ?? "",
        }),
      )
      .catch(() => toast.error("Offer context yüklenemedi"))
      .finally(() => setLoading(false));
  }, []);

  const update = (k: keyof OfferContext) => (v: string) => setData((d) => ({ ...d, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/workspace/offer", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Kaydedilemedi");
        return;
      }
      toast.success("Offer context güncellendi. Bir sonraki mockup ve mesajda devreye girer.");
    } catch (err) {
      console.error("Offer save error:", err);
      toast.error("Bir hata oluştu");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-white/40 text-sm">Yükleniyor...</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#A5B4FC]" />
          My Offer
        </CardTitle>
        <CardDescription>
          Bu workspace ne satıyor? AI mockup, opener ve sales angle bu bilgilere göre kişiselleşir.
          Her mesajda kullanıcının kendi sesi ve fiyat çıpası geçer.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="space-y-5 max-w-2xl">
          <Field
            label="Teklif adı"
            help="Örn: Yerel İşletme Web Paketi, Klaviyo Email Setup, Vasarn Phone Repair Site Setup."
          >
            <Input
              value={data.offerName ?? ""}
              onChange={(e) => update("offerName")(e.target.value)}
              disabled={!canEdit}
              maxLength={80}
              placeholder="Yerel İşletme Web Paketi"
            />
          </Field>

          <Field
            label="Değer önerisi (value proposition)"
            help="Bir cümlede, ne sattığını ve müşteriye ne kazandırdığını anlat. Mockup hero'su ve email opener bu cümleye göre yazılır."
          >
            <textarea
              value={data.valueProposition ?? ""}
              onChange={(e) => update("valueProposition")(e.target.value)}
              disabled={!canEdit}
              maxLength={500}
              rows={3}
              placeholder="Yerel hizmet işletmeleri için 1 sayfalık, mobile-first, online randevu özellikli web sitesi. Booking dakikalar içinde, 14 gün içinde canlı."
              className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#5E6AD2]/50"
            />
          </Field>

          <Field
            label="Sosyal kanıt"
            help="Hangi referanslar / sayılar / case study'ler güvenilirlik ekliyor?"
          >
            <textarea
              value={data.socialProof ?? ""}
              onChange={(e) => update("socialProof")(e.target.value)}
              disabled={!canEdit}
              maxLength={400}
              rows={2}
              placeholder="120+ teslim edilmiş site, ortalama 14 gün lansman, 4.8/5 müşteri puanı."
              className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#5E6AD2]/50"
            />
          </Field>

          <Field
            label="Hook / opening line"
            help="Mesajın ilk satırında geçecek dikkat çekici cümle."
          >
            <textarea
              value={data.offerHook ?? ""}
              onChange={(e) => update("offerHook")(e.target.value)}
              disabled={!canEdit}
              maxLength={300}
              rows={2}
              placeholder="Sitenizin mobile load time'ını ölçtüm, 4.8sn. Booking butonu yok. Size 1 sayfalık taslak hazırladım."
              className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#5E6AD2]/50"
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Mesaj hedefi" help="Reply geldiğinde ne istiyorsun?">
              <select
                value={data.objective ?? ""}
                onChange={(e) => update("objective")(e.target.value)}
                disabled={!canEdit}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-[#5E6AD2]/50"
              >
                <option value="">Seç...</option>
                {OBJECTIVE_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </Field>

            <Field label="Ton" help="Mesaj tonu">
              <select
                value={data.tone ?? ""}
                onChange={(e) => update("tone")(e.target.value)}
                disabled={!canEdit}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-[#5E6AD2]/50"
              >
                <option value="">Seç...</option>
                {TONE_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>

            <Field label="Uzunluk">
              <select
                value={data.length ?? ""}
                onChange={(e) => update("length")(e.target.value)}
                disabled={!canEdit}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-[#5E6AD2]/50"
              >
                <option value="">Seç...</option>
                {LENGTH_OPTIONS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </Field>

            <Field label="Dil">
              <select
                value={data.language ?? "tr"}
                onChange={(e) => update("language")(e.target.value)}
                disabled={!canEdit}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-[#5E6AD2]/50"
              >
                {LANGUAGE_OPTIONS.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Gönderen adı" help="Email imzasında çıkacak isim">
              <Input
                value={data.senderName ?? ""}
                onChange={(e) => update("senderName")(e.target.value)}
                disabled={!canEdit}
                maxLength={80}
                placeholder="Mert Acar"
              />
            </Field>

            <Field label="Conversion linki" help="CTA tıklandığında nereye gitsin?">
              <Input
                value={data.conversionLink ?? ""}
                onChange={(e) => update("conversionLink")(e.target.value)}
                disabled={!canEdit}
                maxLength={300}
                placeholder="https://leadac.ai/demo"
              />
            </Field>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" disabled={!canEdit || saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Kaydediliyor...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" /> Kaydet
                </>
              )}
            </Button>
            {!canEdit && (
              <span className="text-xs text-white/40">
                Sadece OWNER ve ADMIN düzenleyebilir.
              </span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-white/70 mb-1">{label}</label>
      {children}
      {help && <p className="text-[11px] text-white/35 mt-1 leading-relaxed">{help}</p>}
    </div>
  );
}
