"use client";
import { usePathname } from "next/navigation";
const COPY: Record<string, [string,string]> = {
 "/admin/control": ["Son 14 gündeki eksik mercekler ile son taban ve aday başarı oranları karar kalitesini gösterir; düşen işler teknik takibi gösterir.", "Eksik incelemeyi aç; Teknik, Alan ve Satış hükümlerini tamamladıktan sonra referans vakaları say."],
 "/admin/control/reviews": ["Teknik, Alan ve Satış aynı başarılı brief kartını kendi merceğinden değerlendirir.", "Bir işletme aç, kartı oku ve kendi hükmünü kaydet. Üç mercek tamamlanınca beklenen kuralları yazarak referans vaka kaydet."],
 "/admin/control/mercekler": ["Bu ekran, hüküm yazabilecek kişilere Teknik, Alan veya Satış merceği atar. Bir kişinin tek merceği olur.", "Kişiyi seç, merceğini kaydet veya kaldır. Atama olmadan İnceleme'de hüküm kaydedilmez."],
 "/admin/control/trace": ["Vaka izi, aynı brief kararının kaynaklarını, iş sürelerini, maliyetini ve düşen işleri gösterir.", "Bir işletme seç; Teknik merceğiyle kaynak zamanını ve hataları incele, sonra İnceleme ekranında hükmünü kaydet."],
 "/admin/control/golden": ["Referans vakalar, üç merceğin baktığı brief için insanın yazdığı beklenen davranışı ve donmuş girdiyi saklar.", "Tamamlanan bir incelemeyi açıp kuralları yaz veya mevcut vakaların saklanan çıktısını taban sayımıyla ölç."],
 "/admin/control/golden/compare": ["Taban saklanan cevabı sayar; aday donmuş girdiden bugünkü head agent ile yeni karar üretir. İkisi de lead'i değiştirmez.", "Taban sayımından sonra aday koşuyu onayla. Tamamlanan iki koşuyu seçip bozulan ve düzelen vakaları oku."],
 "/admin/control/calibration": ["Bu ekran canlı ayarları ve yayın bekleyen kalibrasyon taslaklarını gösterir.", "Değişiklik gerekçesini taslakla kaydet; yayını taslağı yazan kişiden farklı bir yönetici değerlendirir."],
 "/admin/control/deneme": ["Deneme, zincirin bir worker'ını seçtiğin lead'lerde yeniden çalıştırır ve çıktının önceki başarılı koşuya göre hangi alanlarda değiştiğini gösterir.", "Worker'ı seç, birkaç lead işaretle, neyi denediğini yaz ve çalıştır. Koşu bitince fark her lead'in altında açılır; eski sonuçlar silinmez."],
 "/admin/control/audit": ["Denetim, kimin hangi kontrol işlemini neden yaptığının değiştirilemeyen kaydıdır.", "İşlem, kişi veya tarih ile süz; inceleme, referans vaka ve aday koşu kayıtlarının gerekçesini oku."],
 "/admin/control/rehber": ["Bu sayfa paneli hiç görmemiş biri için yazıldı: kelimeler, beş adımlık akış, bir kartın nasıl okunacağı ve bir worker'ın nasıl deneneceği.", "Baştan sona oku ya da içindekilerden aradığın başlığa atla."],
};
export function ControlIntro() {
 const path = usePathname();
 const lines = COPY[path] ?? COPY["/admin/control/trace"];
 return <div className="my-4 space-y-1 text-sm text-[var(--revint-text-2)]"><p>{lines[0]}</p><p>{lines[1]}</p></div>;
}
