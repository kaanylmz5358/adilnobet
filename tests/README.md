# Nöbet Defteri testleri

Uygulamanın (`../index.html`) gerçek kodunu tarayıcı benzeri bir ortamda açar, Supabase yerine bellekte sahte bir veritabanı kullanır.
Canlı veriye hiç dokunmaz; buradaki bütün ekipler ve kişiler uydurmadır.

## Çalıştırma

```bash
bash tests/run.sh hizli      # ~10 dk: özellik testleri + 40 düşman senaryo + telefon arayüzü
bash tests/run.sh tam        # ~1-2 sa: hepsi
bash tests/run.sh fuzz 500   # yalnız düşman senaryolar
bash tests/run.sh batarya    # elle kurulmuş ~70 uç durum
bash tests/run.sh ozellik    # feat/ klasöründeki özellik testleri
bash tests/run.sh arayuz     # telefon, Android, tablet, bilgisayar: her düğme tek tek
```

Sonuç: `tests/out/RAPOR.md`. Sorun varsa çıkış kodu 1.

## Parçalar

| Dosya | Ne yapar |
|---|---|
| `lib/harness.js` | Uygulamayı jsdom'da açar, sahte veritabanı (`makeDB`), ekip kurucu (`fixture`, `SH`, `uid`) |
| `lib/checker.js` | **Bağımsız denetçi**: uygulamanın kodunu kullanmadan, ham ayarlardan ve çıkan listeden bütün kuralları baştan hesaplar |
| `lib/gen.js` | **Düşman senaryo üretici**: tohumdan (seed) tekrar üretilebilir rastgele ekip — 2–28 kişi, 1–4 vardiya ya da oda, izinler, kesin / yok günler, kıdem, cinsiyet, yetkinlik, kurallar, ritim, döngüler, engeller, sabit mesai, önceki ay, tatiller, mola, puan… |
| `lib/ovfix.js` | Bir çözüm önerisinin geçici kurallarını senaryoya uygular (öneri kendi kurallarıyla denetlensin) |
| `fuzz.js` | Her senaryoda: taslak → denetçi → öneriler (her biri ayrı denetlenir, en iyisi uygulanır) → yeniden hazırla (kötüleşmemeli) |
| `battery.js` | Elle kurulmuş uç durumlar (imkânsız kurallar, herkes izinli, tek kişi, NHS / ACGME kuralları…) |
| `feat/*.js` | Özellik testleri (kural paketleri, ekip döngüsü, ayar aktarımı, sihirbaz, önceki ay…) |
| `ui/crawl.py` | Playwright ile gerçek tarayıcı: her ekranda her öğeye tıklar / dokunur; taşma, örtülme, kapanmayan perde, JS hatası arar |
| `ui/gestures.py` | Hareketler: telefonda parmak (sürükle, fiske, kenardan geri), bilgisayarda fare / tekerlek / klavye |
| `ui/xss.py` | Güvenlik: üyelerin yazdığı metinler hiçbir ekranda kod olarak çalışmamalı |
| `ui/make_fixtures.js` | Arayüz testi için yayınlanmış listeli zengin sahte ekipler |
| `regress_seeds.txt` | Daha önce hata bulmuş tohumlar; her `fuzz` çalıştırmasında yeniden denenir (`105o` = eski üreticiyle) |
| `OZELLIKLER.md` | Bütün özellikler ve hangi testin denetlediği |

## Kurallar (testin "geçti" sayması için)

1. Uygulama hiçbir kuralı **sessizce** bozamaz: bozduysa taslakta yazmalı.
2. Asla olmaması gerekenler (izinli güne nöbet, "nöbet tutmaz" kişiye nöbet, aynı anda iki vardiya, katılmadığı vardiya, engelli saat…) hiç olmamalı.
   Tek istisna: onaylı kesin gün — uygulama bunu açıkça yazar.
3. "Bütün sayılar ve kurallar tutturuldu" diyorsa denetçi de temiz bulmalı.
4. Kartta "kusursuz" görünen her öneri, kendi geçici kurallarıyla denetçiden temiz geçmeli; sayı değişiklikleri kartta yazılı olmalı.
5. "Yeniden hazırla" sayılar değişmediyse listeyi asla kötüleştiremez.
6. Hiçbir tıklamada JS hatası olmamalı; hiçbir öğe ekran dışında ya da başka öğenin altında kalmamalı.
7. Bir ekibin / ayın taslağı asla başka ekibe / aya yazılamaz; üyelerin yazdığı hiçbir metin kod olarak çalışamaz.
8. Öneri sırası: sorunları sayıları değiştirmeden çözen bir öneri varken "aynen kalsın" ya da "boş bırak" önde olmamalı (uyarı olarak raporlanır).

## Yeni bir hata bulunca

- Tohumu tekrar çalıştır: `node fuzz.js --seed-list 1234 --suggest 1`
- Uygulamada mı, denetçide mi? Denetçi uygulamanın tasarım kararını yanlış modelliyorsa denetçi düzeltilir; değilse uygulama.
- Düzeltildikten sonra tohumu `regress_seeds.txt`e ekle.
