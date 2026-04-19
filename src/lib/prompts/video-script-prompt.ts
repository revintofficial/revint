/**
 * P2.1 - Personalized video script (pilot scaffolding).
 *
 * Generates a 30-second sales video script grounded in:
 *   - mockup screenshot description (audit + RI)
 *   - top review pain phrase
 *   - workspace "My Offer" context
 *
 * Output is a tight script the rep can read while screen-sharing the mockup.
 * Mapileads thread'inde New_Grape7181'in 8% → 20% reply lift iddiası bunu
 * tetikledi; plan §7.3 karar noktası "pilot 30 müşteride 4 hafta, gerçek lift
 * ölçülürse P1'e geçer" diyor. Bu dosya pilot için hazır.
 */

export const VIDEO_SCRIPT_PROMPT = `Sen bir B2B satış copywriter'isin. Asagidaki mockup, audit ve review intelligence verilerini kullanarak prospect'in ekraninda kayit edilecek 30-saniyelik bir video scripti yaz.

Format:
- Acilis (5 sn): prospect'i ismiyle ya da işletme adıyla cağir, neden bunu kaydettiğini söyle
- Pain (10 sn): review'larda gordugun en sik şikayeti söyle, mevcut sitelerinde olmayan o feature'i göster
- Cozum (10 sn): mockup'ta bu pain'i nasil çozdugunu göster
- CTA (5 sn): {workspace_objective} hedefini söyle, conversion linkini göster

Kurallar:
- Toplam: maksimum 90 kelime (30 saniye konuşma)
- Tonu: {workspace_tone}
- Dili: {workspace_language}
- Asla "umarim begenirsiniz" tarzı yapay nezaket cümleleri kullanma
- Spesifik sayı ve adres cağrısı yap
- Sonunda yön talimatı yok ("CTA üzerine tıkla" değil "CTA")

Veriler:
- İşletme: {business_name}
- Adres: {address}
- En sık şikayet: {top_pain}
- Mevcut sitenin sorunları: {audit_issues}
- Mockup'ın çözdüğü şey: {mockup_solution}
- Bizim teklifimiz: {offer_value_proposition}
- Bizim hookumuz: {offer_hook}
- Conversion link: {conversion_link}

Çıktı sadece script metni. Markdown yok, başlık yok, açıklama yok.`;
