import Link from "next/link";
import { ControlFrame } from "@/components/admin/control-frame";

/**
 * "Nasıl çalışır": written for someone who has never seen the control room.
 * Plain words first, the screen name second, the exact button last. Every
 * term the other screens use is defined here once, in the glossary.
 */

const CONTENTS: Array<[string, string]> = [
  ["ne", "Bu panel ne işe yarar?"],
  ["sozluk", "Kelimeler"],
  ["baslamadan", "Başlamadan önce"],
  ["akis", "Beş adımda akış"],
  ["kart", "Bir inceleme kartı nasıl okunur?"],
  ["hukum", "Hüküm nasıl verilir?"],
  ["deneme", "Bir worker'ı değiştirdim, nasıl test ederim?"],
  ["ekranlar", "Ekranlar tek tek"],
  ["bos", "Ekran boşsa sebebi nedir?"],
  ["roller", "Kim ne yapabilir?"],
];

const GLOSSARY: Array<[string, string]> = [
  ["Lead", "Satış yapmak istediğimiz tek bir işletme. Örneğin bir restoran."],
  ["Çalışma alanı", "Bir müşterimizin hesabı. Lead'ler bir çalışma alanına aittir. FineDine'ın lead'leri \"FineDine Beta\" alanındadır. Panelde her şeyi bir çalışma alanı seçtikten sonra görürsün."],
  ["Worker", "Tek bir işi yapan otomatik program. Biri haritadan yorumları çeker, biri web sitesini okur, biri yorumları özetler, biri kararı yazar."],
  ["Zincir", "Bir lead için sırayla çalışan dört worker: Harita → Site → Yorum → Karar."],
  ["Brief", "Zincirin sonunda çıkan satış kartı. \"Bu işletmeye şu paketi, şu sebeple, şu cümleyle öner\" der. Panelin incelediği şey budur."],
  ["Head agent", "Brief'i yazan yapay zekâ. Kapalıysa brief karar üretmez ve incelenecek bir şey olmaz."],
  ["Mercek", "Bir brief'e hangi gözle baktığın. Üç tane var: Teknik (kaynak doğru mu, güncel mi), Alan (paket ve sıra bu işletmeye uyuyor mu), Satış (bu cümleyi müşteriye söyler miyim). Her kişinin tek merceği olur."],
  ["Hüküm", "Bir brief hakkında kendi merceğinle verdiğin karar: Geçti, Kaldı ya da Tekrar bak."],
  ["Kanıt rafı", "İnceleme kartındaki dört çekmece: Harita, Site, Yorum, Karar. Her satırın solunda yapay zekânın iddiası, sağında o iddianın dayandığı kayıt durur."],
  ["Referans vaka", "Üç merceğin de baktığı bir brief'in dondurulmuş kopyası ve yanına insanın yazdığı \"doğrusu şu olmalıydı\" kuralları. Sınav sorusu gibi düşün: soru sabit, doğru cevap belli."],
  ["Taban sayımı", "O gün saklanan cevapların referans vakalardaki kurallara kaçta kaç uyduğunun sayılması. Yapay zekâ çalışmaz, sadece sayılır."],
  ["Aday koşu", "Bugünkü head agent'ın aynı referans vakaları yeniden çözmesi. Bir değişiklik yaptıktan sonra \"daha iyi mi oldu, bir şey bozuldu mu\" sorusunun cevabı."],
  ["Kapı", "FineDine'a teslimden önce tutması gereken sayılar. Genel Bakış'ta A, B, C diye üç grup hâlinde durur."],
  ["Paket", "FineDine'ın sattığı üç ürün seviyesi: Starter, Growth, Premium."],
  ["Kaçak", "Satış konuşmasının tek konusu; işletmenin para ya da müşteri kaybettiği yer. Örneğin rezervasyon, hesap bekleme, menü."],
  ["Yayın", "Canlıdaki ayarları (hedef müşteri tanımı, paket, oyun kitabı) değiştirme ekranı. Hüküm vermek hiçbir ayarı değiştirmez; ayar yalnızca buradan değişir."],
];

type Step = { title: string; where: string; path: string; what: string; clicks: string[]; result: string; stuck: string };

const STEPS: Step[] = [
  {
    title: "1 · Brief üretilir",
    where: "Vaka izi ya da Deneme",
    path: "/trace",
    what: "Bir lead için zincir çalışır ve sonunda bir brief çıkar. Bu adım çoğunlukla kendiliğinden olur; senin işin brief'in gerçekten çıktığını görmek.",
    clicks: [
      "Soldaki menüden Vaka izi'ni aç.",
      "\"Hepsi\" süzgecini seç ve bir işletmenin adına tıkla.",
      "\"Zincir\" başlığı altında dört satır görürsün: Harita, Site, Yorum, Karar. Her birinin yanında \"Oldu\", \"Düştü\" ya da \"çalışmadı\" yazar.",
    ],
    result: "Karar satırında \"Oldu\" yazıyorsa bu lead'in brief'i hazırdır ve İnceleme'de görünür.",
    stuck: "Karar \"çalışmadı\" ya da brief boşsa: head agent kapalı olabilir. Genel Bakış'taki 1. kart sebebi yazar.",
  },
  {
    title: "2 · Üç mercek hüküm verir",
    where: "İnceleme",
    path: "/reviews",
    what: "Aynı brief'e üç farklı kişi, üç farklı gözle bakar. Her biri yalnızca kendi hükmünü yazar. Başkasının hükmünü, kendi hükmünü kaydetmeden göremezsin; böylece kimse kimseden etkilenmez.",
    clicks: [
      "Soldaki menüden İnceleme'yi aç.",
      "Solda \"Senin sıran\" listesi durur. En üstteki işletme zaten açıktır.",
      "Ortadaki kartı oku (nasıl okunacağı aşağıda).",
      "En altta Geçti, Kaldı ya da Tekrar bak'ı seç.",
      "\"Kaydet ve sıradakine geç\" düğmesine bas. Sıradaki işletme kendiliğinden açılır.",
    ],
    result: "\"Senin sıran\" listesi boşalana kadar devam et. Baktığın brief'ler \"Diğer mercekler bekleniyor\" listesine geçer.",
    stuck: "Düğmeler soluksa ve \"Sana bir mercek atanmadı\" yazıyorsa: bir yöneticinin Mercekler ekranından sana mercek ataması gerekir.",
  },
  {
    title: "3 · Brief referans vakaya çevrilir",
    where: "İnceleme (kartın içindeki \"Referans vaka yap\" düğmesi)",
    path: "/golden",
    what: "Üç mercek de baktıktan sonra, merceği olan biri \"bu işletme için doğru cevap şuydu\" diye kuralları yazar. Yapay zekânın cevabı kopyalanmaz; kuralı insan yazar.",
    clicks: [
      "Referans vakalar ekranını aç. \"Üç mercek tamamlandı\" yazan bir işletmenin bağlantısına tıkla.",
      "Açılan kartta \"Referans vaka yap\" düğmesine bas.",
      "Beklenen paketi ve beklenen kaçağı seç. Emin olmadığın alanı \"Kural yok\" bırak.",
      "Söylenmemesi gereken bir cümle varsa \"Yasak iddialar\"a yaz ve Ekle'ye bas.",
      "Altta \"Bu kurallarla donmuş çıktı geçer\" ya da kalış sebebi görünür. Sonra \"Referans vakayı kaydet\"e bas.",
    ],
    result: "Vaka, Referans vakalar listesinde görünür. Lead sonradan değişse bile bu kopya değişmez.",
    stuck: "Düğme soluksa altında hangi merceğin eksik olduğu yazar. O mercek hükmünü vermeden vaka açılmaz.",
  },
  {
    title: "4 · Taban sayımı yapılır",
    where: "Referans vakalar",
    path: "/golden",
    what: "Biriken vakalarda saklanan cevapların kaçı kurallara uyuyor, sayılır. Bu, bugünkü kalitenin notudur.",
    clicks: [
      "Referans vakalar ekranını aç.",
      "\"Saklanan çıktıları taban olarak say\" düğmesine bas.",
    ],
    result: "Genel Bakış'ta \"Son taban\" kartında oran görünür, örneğin \"%80 (8/10)\". Yanındaki aralık, bu kadar az vakayla sayının ne kadar oynayabileceğini söyler.",
    stuck: "\"Önce bir İnceleyen referans vaka kaydetmeli\" diyorsa henüz hiç vaka yoktur; 3. adıma dön.",
  },
  {
    title: "5 · Aday koşu ile karşılaştırılır",
    where: "Referans vakalar → Karşılaştır",
    path: "/golden/compare",
    what: "Head agent'ta ya da kurallarda bir şey değiştirdikten sonra, aynı vakalar bugünkü sistemle yeniden çözülür ve tabanla yan yana konur.",
    clicks: [
      "Referans vakalar ekranında sağ üstteki Karşılaştır'a tıkla.",
      "Onay kutusunu işaretle ve \"Donmuş girdiden aday kararları üret\"e bas. (Yalnızca Yönetici.)",
      "\"Koşu durumunu yenile\" ile bitmesini bekle.",
      "Taban ve aday koşuyu seç; \"N bozuldu, N düzeldi, N aynı\" satırını oku.",
    ],
    result: "Bozulan vaka yoksa değişiklik güvenlidir. Bozulan varsa hangi işletmede, hangi kuraldan kaldığı satırında yazar.",
    stuck: "Aday koşu yapay zekâyı çalıştırır, yani para harcar; bu yüzden onay ister. Hiçbir lead'e yazmaz.",
  },
];

const SCREENS: Array<[string, string, string]> = [
  ["Genel Bakış", "", "Güne buradan başla. En üstteki \"Akış\" şeridi beş adımın hangisinde olduğunu ve sıradaki adımı söyler. Altında bugün düşen işler ve teslim kapıları durur."],
  ["İnceleme", "/reviews", "Brief'leri okuyup hüküm verdiğin yer. Günlük işin çoğu burada geçer."],
  ["Vaka izi", "/trace", "Bir lead için hangi worker ne zaman çalıştı, ne kadar sürdü, kaça mal oldu, nerede düştü. Bir şey ters gittiğinde bakılacak yer."],
  ["Deneme", "/deneme", "Bir worker'ı seçtiğin lead'lerde yeniden çalıştırıp çıktının neresinin değiştiğini görürsün."],
  ["Referans vakalar", "/golden", "Dondurulmuş vakaların listesi, taban sayımı ve karşılaştırma."],
  ["Uyum", "/uyum", "Üç mercek birbirine ne kadar katılıyor? Çok ayrışıyorlarsa kurallar net değildir. Yeterli vaka birikene kadar bu ekran \"yeterli vaka yok\" der."],
  ["Yayın", "/calibration", "Canlı ayarları değiştirme. Taslağı yazan kişi yayınlayamaz; başka bir yönetici onaylar."],
  ["Mercekler", "/mercekler", "Kimin hangi mercekle baktığı. Yalnızca Yönetici değiştirir."],
  ["Denetim", "/audit", "Kim, ne zaman, neyi, neden yaptı. Silinemez kayıt."],
];

const EMPTY: Array<[string, string]> = [
  ["İnceleme'de \"İncelemesi eksik brief yok\"", "Son 14 günde bu çalışma alanında karar taşıyan brief üretilmemiş ya da hepsine üç mercek bakmış. Doğru çalışma alanında mısın? Sağ üstte adı yazar."],
  ["\"Senin sıran\" boş ama diğer liste dolu", "Sen kendi merceğinle hepsine baktın. Kalanlar diğer iki merceği bekliyor."],
  ["Referans vakalar boş", "Henüz hiçbir brief'te üç mercek tamamlanmadı ya da tamamlananlar vakaya çevrilmedi (3. adım)."],
  ["Uyum'da sayı yok", "Uyum, üç merceği tamamlanmış brief'lerden hesaplanır. Birkaç brief'le hesaplanamaz."],
  ["Genel Bakış'ta kapılar \"yetersiz veri\"", "Sayı var ama karar vermeye yetmiyor. 50 vakanın altında oran güvenilir değildir; ekran bunu açıkça söyler."],
  ["Deneme'de \"kuyruğa alınamadı\"", "Kayıt açıldı ama işleri çalıştıran arka plan servisine ulaşılamadı. Teknik ekibe haber ver."],
  ["Brief var ama içi boş", "Head agent o çalışma alanında kapalıyken çalışmış. Bu brief'ler incelemeye düşmez; Genel Bakış'taki 1. kart bunu yazar."],
];

export default async function GuidePage({ searchParams }: { searchParams: Promise<{ workspaceId?: string }> }) {
  const { workspaceId } = await searchParams;
  const suffix = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : "";
  const to = (path: string) => `/admin/control${path}${suffix}`;
  return (
    <ControlFrame workspaceId={workspaceId}>
      <article className="max-w-3xl space-y-10">
        <header className="space-y-3">
          <h1 className="text-2xl font-semibold">Nasıl çalışır</h1>
          <p className="text-sm text-[var(--revint-text-2)]">
            Bu sayfa paneli hiç görmemiş biri için yazıldı. Baştan sona okuman on dakika sürer. Aradığın bir şey varsa aşağıdaki başlıklardan atla.
          </p>
          <nav aria-label="İçindekiler">
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              {CONTENTS.map(([id, label]) => (
                <li key={id}><a href={`#${id}`} className="text-[var(--revint-500)]">{label}</a></li>
              ))}
            </ol>
          </nav>
        </header>

        <Section id="ne" title="Bu panel ne işe yarar?">
          <P>Sistemimiz her restoran için otomatik bir satış kartı yazar. Bu karta <B>brief</B> diyoruz. Brief, satış temsilcisine &quot;bu işletmeye şunu, şu sebeple öner&quot; der.</P>
          <P>Yapay zekâ yanılabilir: olmayan bir şeyi var sanabilir, eski bir bilgiye dayanabilir, yanlış paketi önerebilir. Bu panel, o kartların <B>doğru olup olmadığını insanların kontrol ettiği</B> yerdir.</P>
          <P>Bir okul sınavı gibi düşün. Önce öğrencinin kâğıdını (brief) üç öğretmen okur ve not verir. Sonra iyi incelenmiş kâğıtlardan bir <B>cevap anahtarı</B> oluşturulur. Sistemde bir şey değiştirdiğimizde aynı sınavı tekrar yaptırır, notun düşüp düşmediğine bakarız.</P>
          <P>Panelde yaptığın hiçbir şey müşterinin gördüğü brief&apos;i silmez ya da değiştirmez. Hüküm vermek yalnızca kayıt tutar.</P>
        </Section>

        <Section id="sozluk" title="Kelimeler">
          <P>Ekranlarda geçen her kelime burada. Takıldığında buraya dön.</P>
          <dl className="divide-y divide-[var(--revint-border)] rounded-xl border border-[var(--revint-border)] bg-[var(--revint-card)]">
            {GLOSSARY.map(([term, meaning]) => (
              <div key={term} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[150px_1fr] sm:gap-4">
                <dt className="font-medium text-[var(--revint-text-1)]">{term}</dt>
                <dd className="text-[var(--revint-text-2)]">{meaning}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section id="baslamadan" title="Başlamadan önce">
          <Steps items={[
            "Sol menüden Genel Bakış'ı aç. İlk girişte \"Hangi çalışma alanına bakıyorsun?\" diye sorar.",
            "Listeden çalışma alanını seç. Son 14 günde brief'i olanlar en üstte durur. FineDine için \"FineDine Beta\"yı seç.",
            "Sayfanın üstündeki şeritte çalışma alanının adı, rolün (İzleyici, İnceleyen ya da Yönetici) ve e-postan yazar. Yanlış alandaysan \"Alan değiştir\"e bas.",
            "Merceğini öğrenmek için İnceleme'yi aç. En altta \"Teknik merceği\", \"Alan merceği\" ya da \"Satış merceği\" yazar. \"Sana bir mercek atanmadı\" yazıyorsa bir yöneticiden mercek iste.",
          ]} />
          <Note>Bir çalışma alanı seçtikten sonra menüde hangi ekrana geçersen geç aynı alanda kalırsın.</Note>
        </Section>

        <Section id="akis" title="Beş adımda akış">
          <P>Panelin tamamı tek bir hattır. Her adım bir öncekinin çıktısını kullanır; bu yüzden bir adım boşsa sonraki adımların ekranı da boş görünür. Genel Bakış&apos;taki &quot;Akış&quot; şeridi bu beş adımı ve hangisinde olduğunu gösterir.</P>
          <p className="rounded-xl border border-[var(--revint-border)] bg-[var(--revint-card)] px-4 py-3 text-sm text-[var(--revint-text-1)]">
            Brief → Üç mercek hükmü → Referans vaka → Taban sayımı → Aday koşu
          </p>
          {STEPS.map((step) => (
            <div key={step.title} className="space-y-3 rounded-xl border border-[var(--revint-border)] bg-[var(--revint-card)] p-5">
              <h3 className="text-base font-semibold text-[var(--revint-text-1)]">{step.title}</h3>
              <p className="text-sm text-[var(--revint-text-2)]">
                Ekran: <Link href={to(step.path)} className="text-[var(--revint-500)]">{step.where}</Link>
              </p>
              <P>{step.what}</P>
              <Steps items={step.clicks} />
              <p className="text-sm text-[var(--revint-text-1)]"><B>Sonuç:</B> {step.result}</p>
              <p className="text-sm text-[var(--revint-text-2)]"><B>Takılırsan:</B> {step.stuck}</p>
            </div>
          ))}
          <Note>İlk gün yalnızca 1. ve 2. adımı yaparsın. 3, 4 ve 5. adımlar yeterli brief incelendikten sonra anlam kazanır.</Note>
        </Section>

        <Section id="kart" title="Bir inceleme kartı nasıl okunur?">
          <P>İnceleme&apos;de bir işletmeye tıkladığında ortada bir kart açılır. Yukarıdan aşağıya şunlar durur:</P>
          <Steps items={[
            "İşletmenin adı, adresi, puanı ve yorum sayısı. \"Siteyi aç\" ve \"Haritada aç\" bağlantılarıyla gerçeğine bakabilirsin.",
            "Merceğinin sorusu. Teknik: \"Bu bulgu hangi kaynaktan, ne zaman geldi?\" Alan: \"Bu hesapta bu sıra ve bu paket uyar mı?\" Satış: \"Bu cümleyi yarın söyler miyim?\"",
            "Kanıt rafı: Harita, Site, Yorum, Karar adlı dört çekmece. İlk ikisi açık gelir; diğerlerine tıklayarak açarsın.",
            "Her çekmecede satırlar vardır. Solda \"İddia\" (sistemin söylediği), sağda \"Dayanak\" (bunu nereden çıkardığı) durur.",
            "Turuncu çerçeveli \"Çelişki\" satırı, sistemin kendi kayıtlarının birbirini tutmadığı yerdir. Önce bunlara bak.",
            "En altta \"Mercek hükümleri\": kim baktı, kim bakmadı. Başkalarının ne dediği, sen kaydedene kadar gizlidir.",
          ]} />
          <P><B>Tek bir soru sor:</B> soldaki iddia, sağdaki dayanaktan gerçekten çıkıyor mu? Çıkıyorsa Geçti. Çıkmıyorsa, dayanak eskiyse ya da hiç yoksa Kaldı.</P>
          <Note>Örnek: Solda &quot;Rezervasyon görünmüyor&quot; yazıyor ama siteyi açtığında rezervasyon düğmesi var. İddia yanlış; bu bir Kaldı&apos;dır.</Note>
        </Section>

        <Section id="hukum" title="Hüküm nasıl verilir?">
          <dl className="space-y-3 text-sm">
            <Def term="Geçti">Kendi merceğinle baktığında kartta yanlış bir şey yok. Not yazmak zorunlu değil.</Def>
            <Def term="Kaldı">Kartta düzeltilmesi gereken bir hata var. Üç şey zorunlu: hatanın sınıfı, ciddiyeti ve bir cümlelik not.</Def>
            <Def term="Tekrar bak">Emin değilsin ya da başka birinin bakması gerekiyor. Brief kuyrukta kalmaz ama &quot;karar verilemedi&quot; olarak kaydedilir.</Def>
          </dl>
          <P>Kaldı&apos;yı seçtiğinde hata sınıfları listelenir. Her sınıfın altında ne zaman seçileceği (&quot;Seç&quot;) ve ne zaman seçilmeyeceği (&quot;Seçme&quot;) yazar. En sık kullanılanlar:</P>
          <dl className="space-y-3 text-sm">
            <Def term="Yanlış işletme">Kart başka bir işletmeyi anlatıyor ya da bu işletme hedef kitlemiz değil.</Def>
            <Def term="Kaynak eski">Bilgi bir zamanlar doğruydu, artık değil.</Def>
            <Def term="İddia dayanaksız">Kart bir şey söylüyor ama gösterdiği kanıtta bu yok.</Def>
            <Def term="Paket uymuyor">Önerilen paket bu işletmenin büyüklüğüne ya da ihtiyacına uymuyor.</Def>
            <Def term="Puan bandın dışında">Uygunluk puanı bariz şekilde fazla yüksek ya da fazla düşük.</Def>
            <Def term="Oyun kitabına aykırı">Satışta söylememe kararı aldığımız bir şey söylenmiş.</Def>
            <Def term="Boru hattında adım eksik">Bir worker çalışmamış ve kart eksik bilgiyle yazılmış.</Def>
          </dl>
          <P>Ciddiyet üç seviyedir: <B>Bugün bakar</B> (müşteriye gitmeden düzeltilmeli), <B>Bu hafta</B> (önemli ama acil değil), <B>Kayıt</B> (bilinsin yeter).</P>
          <Note>Bir kartta iki dakikadan fazla kalıyorsan büyük ihtimalle kart fazla karışık. Tekrar bak de, notuna sebebini yaz ve devam et. Yanlış kaydettiysen aynı kartı açıp yeniden kaydet; en yeni hüküm sayılır.</Note>
        </Section>

        <Section id="deneme" title="Bir worker'ı değiştirdim, nasıl test ederim?">
          <P>Örnek: site okuyan worker güncellendi ve artık rezervasyon sistemini daha iyi bulması bekleniyor. Bunu veritabanına bakmadan şöyle görürsün:</P>
          <Steps items={[
            "Sol menüden Deneme'yi aç.",
            "Üstteki dört karttan denemek istediğin adımı seç. Site için \"Site\" kartı.",
            "Listeden birkaç işletme işaretle. Bir denemede en fazla 10 tane.",
            "\"Neyi deniyorsun?\" kutusuna bir cümle yaz. Bu cümle Denetim kaydına geçer.",
            "Çalıştır düğmesine bas. Sayfa beş saniyede bir kendini yeniler; beklemen yeterli.",
            "Koşu bitince işletmenin kartında \"Bu koşu ne buldu?\" başlığı altında bulgular görünür.",
          ]} />
          <P><B>Kartı okumak:</B> her kutu tek bir bilgidir, örneğin &quot;Rezervasyon sistemi: Var&quot;. Önceki koşuya göre değişen kutular renkli çerçeveyle en üstte durur ve &quot;Değişti&quot; yazar; altındaki &quot;Önce:&quot; satırı eski değeri gösterir. Kartın başındaki cümle kaç bilginin değiştiğini söyler.</P>
          <P>İşletme adının yanındaki etiket sonucu özetler: <B>Tamamlandı</B>, <B>Çalışmadan durdu</B> (sebebi ilk kutuda yazar), <B>Düştü</B> (hata cümlesi kartta yazar), <B>Çalışıyor</B> ya da <B>Hiç çalışmadı</B>. Yalnızca değişenleri görmek için listenin üstündeki &quot;Değişenler&quot; süzgecine bas.</P>
          <P>Değişikliğin doğru olup olmadığını anlamak için karttaki site bağlantısını aç: yeni değer gerçeği mi söylüyor? Kartın en altındaki &quot;Sistemde şu an kayıtlı olan&quot; bölümü, bu işletmenin İnceleme&apos;de nasıl görüneceğini gösterir.</P>
          <Note>Deneme eski sonucu silmez; her çalıştırma yeni bir kayıt açar. Başlatmak Yönetici yetkisi ister. Karar worker&apos;ını denemek yapay zekâyı çalıştırır, yani para harcar.</Note>
        </Section>

        <Section id="ekranlar" title="Ekranlar tek tek">
          <dl className="divide-y divide-[var(--revint-border)] rounded-xl border border-[var(--revint-border)] bg-[var(--revint-card)]">
            {SCREENS.map(([name, path, text]) => (
              <div key={name} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[150px_1fr] sm:gap-4">
                <dt><Link href={to(path)} className="font-medium text-[var(--revint-500)]">{name}</Link></dt>
                <dd className="text-[var(--revint-text-2)]">{text}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section id="bos" title="Ekran boşsa sebebi nedir?">
          <P>Boş ekran çoğu zaman bozukluk değildir; bir önceki adımın henüz yapılmadığını gösterir.</P>
          <dl className="space-y-3 text-sm">
            {EMPTY.map(([seen, why]) => <Def key={seen} term={seen}>{why}</Def>)}
          </dl>
        </Section>

        <Section id="roller" title="Kim ne yapabilir?">
          <P>İki ayrı şey var ve karıştırılmamalı: <B>rol</B> ne yapmaya yetkin olduğunu, <B>mercek</B> hangi gözle baktığını söyler.</P>
          <dl className="space-y-3 text-sm">
            <Def term="İzleyici">Her ekranı görür, hiçbir şey kaydedemez.</Def>
            <Def term="İnceleyen">Merceği atanmışsa hüküm verir, referans vaka kaydeder, taban sayımını başlatır.</Def>
            <Def term="Yönetici">Bunlara ek olarak mercek atar, aday koşuyu ve denemeyi başlatır, ayar yayınlar.</Def>
          </dl>
          <Note>Yönetici olmak mercek sahibi olmak demek değildir. Yöneticinin de hüküm verebilmesi için kendine bir mercek ataması gerekir. Bir kişinin aynı anda tek merceği olur.</Note>
        </Section>
      </article>
    </ControlFrame>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-6 space-y-3">
      <h2 id={`${id}-title`} className="text-lg font-semibold text-[var(--revint-text-1)]">{title}</h2>
      {children}
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-relaxed text-[var(--revint-text-2)]">{children}</p>;
}

function B({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-[var(--revint-text-1)]">{children}</strong>;
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="list-decimal space-y-2 pl-5 text-sm text-[var(--revint-text-1)]">
      {items.map((item) => <li key={item}>{item}</li>)}
    </ol>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-[var(--revint-border)] bg-[var(--revint-surface)] px-3 py-2 text-sm text-[var(--revint-text-2)]">{children}</p>;
}

function Def({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-medium text-[var(--revint-text-1)]">{term}</dt>
      <dd className="mt-0.5 text-[var(--revint-text-2)]">{children}</dd>
    </div>
  );
}
