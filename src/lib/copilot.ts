/**
 * P1.2 - AI sales co-pilot chat (server-side).
 *
 * Workspace-wide chat that knows all leads. Builds a compact context block
 * (top 30 leads by recency × top score, basic audit + sales opportunity facts),
 * sends to Gemini 2.5 Flash with a sales-assistant system prompt, persists the
 * exchange to CopilotMessage table, returns the assistant's response.
 *
 * Tier-gated quotas (per plan §7 decision #2):
 *   - Free:      5 messages / day
 *   - Pro Solo:  50 messages / day
 *   - Pro Team:  200 messages / day
 *   - Agency:    unlimited
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";
import type { Plan } from "@/generated/prisma/client";

const SYSTEM_PROMPT = `Sen Leadac AI'in workspace co-pilot'usun. Kullanıcı outbound satış yapan bir ajans/freelance/SDR. Sen onun lead listesini, mockup'larını, opportunity skorlarını ve review intelligence verilerini biliyorsun.

Çalışma kuralların:
- Önce sorulanı anla, varsayım yapma. Belirsizse tek soru sor.
- Cevaplarını kısa tut, max 5 madde ya da 4 kısa paragraf
- Spesifik lead'lere referans verirken adıyla değil "Lead 12" / "Lead 47" gibi index ile çağır (UI bunları otomatik link'e çevirir)
- Pitch yazarken kullanıcının workspace "My Offer" context'inden faydalan
- Türkçe mi İngilizce mi konuşulduğunu kullanıcıdan algıla, otomatik geç
- Asla generic SaaS guru tonu kullanma. Net, somut, sayıyla destekle

Sınırların:
- Lead datası dışında konuşma
- Asla otomatik aksiyon alma (mesaj gönderme, status değiştirme); sadece öner
- Bilmediğin şeye "bilmiyorum" de`;

const TIER_LIMITS: Record<Plan, number> = {
  FREE: 5,
  PRO: 50,
  PRO_TEAM: 200,
  AGENCY: 10_000,
};

export class CopilotQuotaExceeded extends Error {
  used: number;
  limit: number;
  constructor(used: number, limit: number) {
    super(`Co-pilot daily quota reached: ${used}/${limit}`);
    this.used = used;
    this.limit = limit;
  }
}

export async function sendCopilotMessage(input: {
  workspaceId: string;
  userId: string;
  workspacePlan: Plan;
  message: string;
}): Promise<{ reply: string; leadIds: string[] }> {
  const limit = TIER_LIMITS[input.workspacePlan] ?? 5;

  // Count today's messages.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const usedToday = await prisma.copilotMessage.count({
    where: {
      workspaceId: input.workspaceId,
      role: "USER",
      createdAt: { gte: since },
    },
  });
  if (usedToday >= limit) {
    throw new CopilotQuotaExceeded(usedToday, limit);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");
  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { maxOutputTokens: 1024, temperature: 0.4 },
    systemInstruction: SYSTEM_PROMPT,
  });

  // Build compact context: top 30 leads by recency.
  const recentLeads = await prisma.lead.findMany({
    where: { workspaceId: input.workspaceId },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      businessName: true,
      borough: true,
      hasWebsite: true,
      rating: true,
      reviewCount: true,
      salesOpportunity: {
        select: {
          opportunityScore: true,
          suggestedOffer: true,
          status: true,
          bestSalesAngle: true,
        },
      },
      reviewAnalysis: {
        select: { leadScore: true, painPhrases: true },
      },
    },
  });

  const leadIndex: string[] = [];
  const leadLines = recentLeads.map((l, i) => {
    leadIndex.push(l.id);
    const score = l.salesOpportunity?.opportunityScore ?? "-";
    const status = l.salesOpportunity?.status ?? "-";
    const offer = l.salesOpportunity?.suggestedOffer ?? "-";
    const reviewScore = l.reviewAnalysis?.leadScore ?? "-";
    return `Lead ${i + 1} (${l.id}): ${l.businessName} · ${l.borough ?? ""} · score ${score} · review-score ${reviewScore} · ${status} · ${offer} · website ${l.hasWebsite ? "yes" : "no"}`;
  });

  // Workspace offer context.
  const ws = await prisma.workspace.findUniqueOrThrow({
    where: { id: input.workspaceId },
    select: {
      offerName: true,
      valueProposition: true,
      offerHook: true,
      objective: true,
      tone: true,
      language: true,
      conversionLink: true,
    },
  });

  const offerBlock = [
    ws.offerName && `Teklif: ${ws.offerName}`,
    ws.valueProposition && `Değer: ${ws.valueProposition}`,
    ws.offerHook && `Hook: ${ws.offerHook}`,
    ws.objective && `Hedef: ${ws.objective}`,
    ws.tone && `Ton: ${ws.tone}`,
    ws.language && `Dil: ${ws.language}`,
    ws.conversionLink && `Link: ${ws.conversionLink}`,
  ]
    .filter(Boolean)
    .join("\n");

  const contextBlock = `## Workspace bağlamı
${offerBlock || "Workspace 'My Offer' bos."}

## Son 30 lead (en yeni → en eski)
${leadLines.join("\n")}

---
Kullanicinin sorusu:
${input.message}`;

  const result = await model.generateContent(contextBlock);
  const reply = result.response.text().trim();
  const tokensIn = Math.ceil(contextBlock.length / 4);
  const tokensOut = Math.ceil(reply.length / 4);

  await prisma.copilotMessage.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      role: "USER",
      content: input.message,
      leadIds: leadIndex,
      tokensIn,
      tokensOut: 0,
    },
  });
  await prisma.copilotMessage.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      role: "ASSISTANT",
      content: reply,
      leadIds: leadIndex,
      tokensIn: 0,
      tokensOut,
    },
  });

  return { reply, leadIds: leadIndex };
}
