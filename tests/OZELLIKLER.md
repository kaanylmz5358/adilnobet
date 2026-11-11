# Özellik envanteri ve test kapsamı

İlk günden bu yana eklenen her özellik ve onu hangi testin denetlediği.
Kısaltmalar: **D** = düşman senaryo üretici + bağımsız denetçi (`fuzz.js`, `lib/gen.js`, `lib/checker.js`) ·
**B** = uç durum bataryası (`battery.js`) · **Ö** = özellik testi (`feat/`) · **A** = arayüz taraması (`ui/crawl.py`, telefon / bilgisayar / tablet / Android) ·
**C** = yalnız çökmeme / JS hatası (sonuç denetçiyle kanıtlanamaz).

## Liste kurma (çözücü)

| Özellik | Test |
|---|---|
| Günlük (oda) nöbeti, genel oda sayısı, iki nöbet arası en az gün | D, B |
| Vardiyalı liste: vardiya saatleri, kişi sayısı, geçerli günler, gece yarısını aşan vardiya | D, B |
| Mesai + nöbet, 24 saat devir, hafta sonu devir saati | B, Ö (sihirbaz) |
| İcap / yedek vardiyası (ana listeden ayrı, eşit dağıtım) | D, B |
| Sabit mesai (kişi kartından), mesai saatleri, tatilde mesai | D, B |
| Vardiya arası en az dinlenme saati | D, B |
| Kişiye özel vardiya, "yalnız seçilenler", "seçilenler hariç", kişi kartında kapalı vardiya | D, B |
| Saat / gün engelleri ("bu saatlerde çalışamaz", "yalnız bu saatlerde") | D |
| Kesin sayı (kim kaç nöbet), kesin gece sayısı, gece yasağı, kişiye özel iki nöbet arası | D, B |
| Sayıları program dağıtsın (adil pay), yarı zamanlı oran | D, B |
| İzne oranlı pay, devirli adalet (aylar arası), eski ay sayılarının yok sayılması | D, B |
| Boş yer politikası: hepsi dolsun / sayılara göre boş kalabilir | D, B |
| Önceki ayın son günleri (kuyruk) kurallarda sayılır | D, Ö (onceki_ay) |
| Sabit ritim (2+2, 1+2 …) ve aralıklı ritim (art arda en az–en çok çalışma / izin) | D, B, Ö (sekreter_ritim) |
| Kıdem: komposizyon (vardiyada / günde en az N üst, N alt), "alt kıdemli yalnız kalmasın" (vardiya / gün / aynı saatler) | D, B |
| Cinsiyet: karışık olsun / az olan yayılsın | D, B |
| Yetkinlik etiketleri: "her vardiyada en az 1 YB", "bu vardiyaya yalnız Triyaj" | D, B |
| İki kişi birlikte / ayrı | D, B |
| Kurallar: ayda / haftada / art arda / herhangi N günde nöbet, gece, saat, vardiya, uzun vardiya sınırı | D, B |
| Boş gün kuralları (ayda, haftada, art arda, herhangi N günde) | D, B |
| Hafta sonu: ayda N, art arda N, herhangi N hafta sonunda, bölünmesin, iki gün aynı vardiya, cumartesi çalışan pazar çalışmasın | D, B |
| Yasak vardiya sırası (gece → ertesi gün gündüz …) | D, B, Ö (vardiya_eslestirme) |
| Sonrasında izin (gece / nöbet sonrası N gün; art arda k sonrası) | D, B |
| Eşit dağıt (bir vardiyayı herkese eşit) | D, B |
| Tarihe / bayrama / hafta gününe özel kişi sayısı, takvimden gün gün kişi sayısı | D, B |
| Vardiya döngüsü (14 hazır düzen + 8 saatlik üçlü), ekip döngüsü (A/B/C/D, başlangıç tarihli) | D, B, Ö (team_cycle, paket12) |
| Ücretsiz mola (net saat), zor nöbet puanı, vardiya süresi sınırı | D, B (x_pts), Ö (paket10, paket12) |
| Nöbet sonrası izin ve sıra kuralları (Perşembe/Cuma sonrası izin, gün sınırı, Ek Cumartesi, fazla nöbet sırası) | D, B |
| İstekler: istiyor / istemiyor / kesin / nöbet yok / izin; vardiyaya özel istek; dilek önceliği | D, B |
| Onaylı kesin gün kurallara üstün gelir ve bunu açıkça yazar | D |
| Elle sabitleme (📌), "nöbet tutmaz" ve sabit mesaili kişiye kesin gün → bilgi notu | D, B |
| Saat eşitliği (birikimli), listeler arası uyum | B, C |

## Taslak, öneriler, yayın

| Özellik | Test |
|---|---|
| Taslak: üstte açılır, uyarılar, "Neler uymuyor", karar tablosu (sayı / gece) | A, Ö (kural_ekrani) |
| "Bütün sayılar ve kurallar tutturuldu" yalnız gerçekten öyleyse | D (her senaryoda) |
| Katı kural ya da kesin gün kaçarsa ilk taslak kendiliğinden yeniden denenir | D |
| Çözüm önerileri: her öneri kendi geçici kurallarıyla denetçiden geçer; en iyi öneri kartta görülenle aynı liste | D, B |
| Öneri sırası (en az değişiklik, sayı değişimi kartta yazılı) | D, B |
| Yeniden hazırla: sayılar aynıyken liste asla kötüleşmez | D |
| İmkânsızlık kanıtı ("matematiksel olarak tutamaz") ve nedeni | B, Ö (team_cycle) |
| Yayınla, Word / Excel, takvime aktar (.ics, Google Takvim) | A, C |
| Yayınlanan liste kendi ayının kurallarını saklar | B, C |
| Gün düzenleme (önerilen kişi sırası ★), takas istekleri, açık nöbet ilanı ("Ben tutarım") | A, Ö (paket10, paket12) |

## Ekip, hesap, ayarlar

| Özellik | Test |
|---|---|
| Kurulum ve liste hazırlama sihirbazları | Ö (sihirbaz), A |
| Davet kodu, çoklu ekip, yönetici devri, üye çıkarma, test kişileri | A, C |
| İstek takvimi (sürükleyerek boyama), izin onayı, izin / istek sınırları, yıllık izin hakkı | A, Ö (paket10, paket12) |
| Kişi kartı: kıdem, cinsiyet, etiket, çalışma şekli, oran | A |
| Hazır kural paketleri (Türkiye, AB, NHS, ACGME, MLC, iyi uygulama) | Ö (paket10) |
| Türkiye resmi tatilleri tek dokunuş | Ö (paket10) |
| Ayar aktarımı (başka ekipten al / paylaş, kişi verisi aktarılmaz) | Ö (ayar_aktarimi) |
| Ay seçimi (ay ızgarası), çok aylık görünüm, "Bugün" ekranı, geri sayım | A |
| Geliştirici paneli | C |
| Şifre sıfırlama, giriş | C (canlı akış elle) |

## Arayüz (her cihazda ayrı)

Telefon (iPhone, dokunmatik), Android (Pixel), tablet (iPad) ve dokunmatik olmayan bilgisayar (1440×900, fare + klavye):
her sekme, her ayar sayfası ve taslak ekranındaki **her görünen düğme / seçim / alan tek tek** tıklanır ya da dokunulur;
JS hatası, yatay taşma, ekran dışında kalan, başka öğenin altında kalıp tıklanamayan öğe, açılan perdenin kapanması
(bilgisayarda Esc, telefonda dışına dokunma), perde açıkken arka sayfanın kaymaması denetlenir; ardından rastgele "maymun" tıklamaları yapılır.
