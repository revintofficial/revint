/**
 * Idempotent sync: refresh Berkay's two ServicePackage rows from
 * docs/berkay-paketler.md without touching workspace fields
 * (name, language, onboarding, etc).
 *
 * Run: npx tsx scripts/sync-berkay-packages.ts
 */
import { prisma } from "@/lib/prisma";
import "dotenv/config";

const TARGET_EMAIL =
  process.env.TARGET_EMAIL ?? "berkaysirakayaaa@gmail.com";

const PACKAGES = [
  {
    name: "Başlangıç",
    priceLabel: "9.000 TL",
    features: [
      "Tek sayfa modern kuyumcu sitesi (mobil uyumlu)",
      "Canlı gram altın widget (otomatik güncellenir)",
      "WhatsApp Business entegrasyonu — tüm fiyat sorguları WhatsApp'a düşer",
      "Ürün galerisi (10 ürüne kadar)",
      "Google Maps konum + iletişim formu",
      "Domain + 1 yıl hosting dahil",
      "Profesyonel email (mert@sekerkuyumculuk.com gibi)",
      "Marka özelinde SEO — markanız arandığında çıkar (genel terimlerde değil)",
    ],
    isPopular: false,
    sortOrder: 0,
  },
  {
    name: "Pro",
    priceLabel: "18.000 TL",
    features: [
      "Başlangıç paketindeki her şey",
      "Kategorili ürün kataloğu (50+ ürün: alyans, bilezik, kolye, set, pırlanta, gümüş)",
      "Alyans + nişan yüzüğü randevu sistemi (mockup)",
      "Atölye ve usta profilleri",
      "Sertifika ve has ayar gösterimi",
      "Gram altın live widget (otomatik feed önerisi)",
      "Hurda altın bozdurma flow'u",
      "SSS + gelişmiş SEO ('kapalıçarşı kuyumcu', 'alyans ayarı nasıl yapılır' gibi aramalarda görünür)",
      "Google Analytics + Search Console kurulumu",
      "Sosyal medya / Instagram entegrasyonu",
      "3 ay teknik destek",
      "Profesyonel email (mert@sekerkuyumculuk.com gibi)",
    ],
    isPopular: true,
    sortOrder: 1,
  },
];

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: TARGET_EMAIL },
    select: { id: true },
  });
  if (!user) throw new Error(`No public.users row for ${TARGET_EMAIL}`);

  const member = await prisma.workspaceMember.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { workspaceId: true },
  });
  if (!member) throw new Error(`No workspace membership for ${TARGET_EMAIL}`);

  const workspaceId = member.workspaceId;
  console.log(`Target workspace: ${workspaceId}`);

  for (const pkg of PACKAGES) {
    const result = await prisma.servicePackage.upsert({
      where: { workspaceId_name: { workspaceId, name: pkg.name } },
      create: { workspaceId, ...pkg },
      update: {
        priceLabel: pkg.priceLabel,
        features: pkg.features,
        isPopular: pkg.isPopular,
        sortOrder: pkg.sortOrder,
      },
      select: { id: true, name: true, priceLabel: true, features: true },
    });
    console.log(
      `  ✓ ${result.name} (${result.priceLabel}) — ${result.features.length} özellik`,
    );
  }

  const all = await prisma.servicePackage.findMany({
    where: { workspaceId },
    orderBy: { sortOrder: "asc" },
    select: { name: true, priceLabel: true, isPopular: true, features: true },
  });
  console.log(`\nWorkspace'teki tüm paketler (${all.length}):`);
  for (const p of all) {
    console.log(`  - ${p.name} (${p.priceLabel}) ${p.isPopular ? "[Popular]" : ""}`);
    for (const f of p.features) console.log(`      • ${f}`);
  }
}

main()
  .catch((err) => {
    console.error("sync failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
