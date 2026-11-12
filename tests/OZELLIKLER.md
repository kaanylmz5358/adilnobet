# Özellik envanteri ve test kapsamı

İlk günden bu yana eklenen her özellik ve onu hangi testin denetlediği.
Kısaltmalar: **D** = düşman senaryo üretici + bağımsız denetçi (`fuzz.js`, `lib/gen.js`, `lib/checker.js`) ·
**B** = uç durum bataryası (`battery.js`) · **Ö** = özellik testi (`feat/`) · **A** = arayüz taraması (`ui/crawl.py`, telefon / bilgisayar / tablet / Android) ·
**C** = yalnız çökmeme / JS hatası (sonuç denetçiyle kanıtlanamaz) · **G** = güvenlik testi · **H** = hareket testi (`ui/gestures.py`).

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
| Kesin gece sayısı programın hesapladığı paydan büyükse pay geceleri karşılayacak kadar artar | D, Ö (gece_payi, gece_payi_rastgele) |
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
| Kuralın iki seviyesi: "mümkün olduğunca" / "asla"; "asla" tutmazsa "bu ay mümkün olduğunca uygulansın" ve "asla bozulmasın (o yerler boş)" önerileri | Ö (oneri_onizleme), D |
| Sonrasında izin (gece / nöbet sonrası N gün; art arda k sonrası) | D, B |
| Eşit dağıt (bir vardiyayı herkese eşit) | D, B |
| Tarihe / bayrama / hafta gününe özel kişi sayısı, takvimden gün gün kişi sayısı | D, B |
| Vardiya döngüsü (14 hazır düzen + 8 saatlik üçlü), ekip döngüsü (A/B/C/D, başlangıç tarihli) | D, B, Ö (team_cycle, paket12) |
| Ücretsiz mola (net saat), zor nöbet puanı, vardiya süresi sınırı | D, B (x_pts), Ö (paket10, paket12) |
| Nöbet sonrası izin ve sıra kuralları (Perşembe/Cuma sonrası izin, gün sınırı, Ek Cumartesi, fazla nöbet sırası) | D, B |
| İstekler: istiyor / istemiyor / kesin / nöbet yok / izin; vardiyaya özel istek: güne dokununca o günün vardiyaları açılır, her biri ayrı seçilir (takvimde "08 ✓ 20 ✗"); dilek önceliği | D, B, A, H, Ö (istek_vardiya) |
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
| Öneriyi önizle ("Listeyi gör"): değişen günler çerçeveli, gün panelinde şimdiki / önerilen kişiler; önizlemeden tek tıkla uygula ya da kapat; önizleme yayınlanamaz | Ö (oneri_onizleme), A |
| Taslakta sorunlu günler kırmızı noktalı; gün panelinde o günün sorunları; elle düzenleyince kaç sorun kalktığı söylenir | Ö (oneri_onizleme), A |
| Yeniden hazırla: sayılar aynıyken liste asla kötüleşmez | D |
| İmkânsızlık kanıtı ("matematiksel olarak tutamaz") ve nedeni | B, Ö (team_cycle) |
| Yayınla, Word / Excel, takvime aktar (.ics, Google Takvim) | A, C, Ö (akislar) |
| Yayınlanan liste kendi ayının kurallarını saklar | B, C |
| Gün düzenleme (önerilen kişi sırası ★; kurala takılan kişi yazılırsa nedeni söylenir), takas istekleri (uygun / kurala takılan), izin onayı, ayı kapatma | A, Ö (akislar, paket10) |
| Takas kabulü ve "ilk isteyen alır" açık nöbeti sunucu işleviyle (`swap_accept`, `open_claim`): liste veritabanındaki son hâlinin üstüne kurulur, sunucu yalnız o değişikliği kabul eder | Ö (akislar, paket12) + `sql/` geri alınan deneme |
| Açık nöbet ilanı ("Ben tutarım") | A, Ö (paket12) |

## Ekip, hesap, ayarlar

| Özellik | Test |
|---|---|
| Kurulum ve liste hazırlama sihirbazları | Ö (sihirbaz), A |
| Davet kodu, yönetici devri, üye çıkarma, test kişileri | A, C |
| Birden çok ekip / ay: taslak başka ekibe ya da aya geçince düşer, yanlış yere yayınlanamaz | Ö (coklu_ekip) |
| Taslaktan hemen önce üyelerin bu arada girdiği istek / izinler tazelenir; boyanan günler kaybolmaz | Ö (tazelik) |
| Güvenlik: üyelerin yazdığı ad, not, etiket, istek değerleri ekranda kod olarak çalışamaz | G (`ui/xss.py`) |
| Veritabanı yetkisi: yayınlı listeyi yalnız yönetici yazar; üye kendi satırında yalnız ad ve birim değiştirir; takas isteğini alıcı yalnız reddeder (kabul sunucuda) | `sql/2026-11-12_yetki_sikilastirma.sql` (geri alınan işlemle denenir) |
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
Aynı tarama sıradan üye gözüyle de yapılır.

Hareket testleri (H): telefonda dokunma, yana sürükleyerek gün boyama, dikey kaydırmanın boyamaması, basılı tutup boyama, perdeyi aşağı çekip
kapatma (az çekince geri gelir, içerik kaydırılmışken önce içerik kayar), hızlı fiske, perde açıkken arka sayfanın kaymaması, ayı parmakla değiştirme,
kenardan geri ve telefonun geri hareketi, tutamaçla kural sıralama. Bilgisayarda fareyle tıklama / sürükleyerek boyama, Esc, dışına tıklama,
tekerlekle perde içi kaydırma, fareyle sürüklemenin ayı yanlışlıkla değiştirmemesi, ay okları ve ← → tuşları, tarayıcı geri tuşu, Tab ile görünür odak.

## Dünyada uygulanan nöbet kuralları → uygulamadaki karşılığı → test

| Kaynak / gelenek | Kural | Uygulamada | Test |
|---|---|---|---|
| Türkiye uzmanlık öğrencisi | Ayda en çok 8 nöbet; herhangi 3 günde en çok 1; gece sonrası 1 gün izin | Kural paketi (kesin) | Ö (paket10), D (lim/duty, roll, after) |
| Türkiye İş Kanunu / hastane | Vardiya arası 11 saat; herhangi 7 günde 1 boş gün; haftada 45 saat; gece en çok 7,5 saat | Dinlenme ayarı, boş gün, saat sınırı, vardiya süresi | D (rest, off/roll, hours/week, len), B |
| AB 2003/88 | 11 saat dinlenme; 7 günde 1 boş gün; 28 günde 192 saat | Aynı kart yapısı (herhangi N günde) | D (hours/roll), B (x_roll_hours) |
| NHS asistan hekim | 72 saat / 7 gün; art arda en çok 4 gece, sonrasında 46 saat; art arda 7 vardiya + 2 gün; art arda 4 uzun vardiya + 2 gün; 2 hafta sonundan 1 | Paket + art arda k sonrası izin + uzun vardiya + kayan hafta sonu | B (x_nhs), D (after k, long, weekend roll) |
| ABD ACGME | 80 saat (28 günde 320), 28 günde 4 boş gün, 24+4 saat | Saat / boş gün herhangi 28 günde | B (x_big_acgme) |
| Denizcilik MLC | 10 saat dinlenme, 7 günde 72 saat | Aynı | D (hours/roll) |
| INRC-II (hemşire çizelgeleme yarışması) | Yasak vardiya sırası, art arda en az–en çok çalışma ve boş gün, tam hafta sonu, toplam / hafta sonu sayısı, yetkinlik, istekler | seq, lim row, off row, wkfull, lim, need / only, istekler | D, B |
| Timefold / QGenda / Amion | Rotasyon, eşleştirme, adalet, izin, takas, icap, açık nöbet | Döngü, iki kişi birlikte/ayrı, denge, izin onayı, takas, icap, açık nöbet ilanı | D, Ö (akislar, paket12, team_cycle) |
| Vardiya düzenleri | DuPont, 2-2-3 (Panama), Kelly, 24/48, 24/72, 48/96, 4×4, 5+2, 4×10, 8 saatlik üçlü | 14 hazır düzen + 3 vardiyalı ekipte üçlü döngüler, başlangıç tarihli A/B/C/D ekipleri | Ö (paket10, team_cycle), D (döngü, ekip döngüsü) |
| Kıdem / cinsiyet / yetkinlik | Kıdemsiz yalnız kalmasın (vardiya / gün / aynı saatler), kompozisyon, karışık ekip | Kıdem ve cinsiyet kuralları, etiketler | D (kıdem, cins, need/only), B |
| Adalet | Gece, hafta sonu, bayram, saat eşitliği; yarı zamanlı oran; aylar arası devir; zor nöbet puanı | Denge ayarları, oran, devir, puan | D (bal, ratio, pts), B |
| Aylık vardiya çizelgesi (acil tipi) | Kişi × gün tablosu (1 gündüz, 2 gece, X boş), toplam saat ve fark; aylık saatler kesin eşit; belli günlerde başka vardiyada gelen kişi (o günler nöbete girmez, saati eşit ya da ± yönetici seçer) | Tablo görünümü, vardiya kodu, Excel'de çizelge, “Saatler eşit (kesin)”, belli günlü özel vardiya | Ö (ozel_vardiya_saat) |

Kapsam dışı (nöbet listesinin işi değil): ücret / puantaj, kart-parmak izi giriş, hastane sistemleri ve çağrı cihazı bağlantısı.
