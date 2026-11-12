/* Düşman senaryo koşucusu.
   node fuzz.js --from 1 --n 200 [--suggest 0.5] [--redraft 0.3] [--out out/fuzz.jsonl] [--seed-list 12,55]
   Her senaryo: rastgele ekip/ayar/istek → taslak → bağımsız denetçi → (öneriler) → (yeniden hazırla).
   KURAL: uygulama hiçbir kuralı SESSİZCE bozamaz; "kusursuz" dediği öneri gerçekten kusursuz olmalı; yeniden hazırla listeyi kötüleştiremez. */
const fs = require("fs"), path = require("path");
const { openApp } = require("./lib/harness");
const { check } = require("./lib/checker");
const { scenario } = require("./lib/gen");
const { applyOv } = require("./lib/ovfix");

const A = process.argv.slice(2), arg = (k, d) => { const i = A.indexOf("--" + k); return i >= 0 ? A[i + 1] : d; };
const FROM = +arg("from", 1), N = +arg("n", 50), PS = +arg("suggest", 0.5), PR = +arg("redraft", 0.3);
const OUT = arg("out", path.join(__dirname, "out", `fuzz_${FROM}_${N}.jsonl`));
const MONTH = arg("month", null), KISI = +arg("kisi", 0) || 0, MODE = arg("mod", null);   // --kisi 50: ekip büyüklüğü sabit · --mod rooms|shifts   // --month 2027-03: hepsi bu ay (ör. yaz saati geçişi denemesi için TZ=Europe/Berlin ile)
const LIST = arg("seed-list", null), NOX = A.includes("--noextra");   // --noextra: ek boyutlar (mola, puan, döngüler) olmadan eski senaryolar
fs.mkdirSync(path.dirname(OUT), { recursive: true });

/* denetçi sorunlarını ailelere ayır */
const FAM = [
  ["leave", /izinli ama atanmış|nöbet yok ama atanmış/], ["noduty", /"nöbet tutmaz" ama/], ["mesaiDuty", /sabit mesaide ama/],
  ["mesai", /mesai yazılmamış|mesai olmamalı|mesai saati/], ["who", /başkasına özel|yalnız seçilenlerin|katılmadığı vardiyada|kişi kartında kapalı/],
  ["shNever", /vardiyası "yok" ama atanmış/], ["shMust", /vardiyası "kesin" ama/], ["must", /kesin nöbet ama atanmamış/],
  ["overlap", /çakışan vardiya/], ["rest", /saat dinlenme yok/], ["double", /iki kez/], ["targets", /nöbet istendi/], ["nights", /gece istendi/],
  ["rhythm", /^ritim/], ["sen", /kıdem/], ["gen", /kadın–erkek/], ["wrOff", /sonrası izinde nöbet \(KATI\)/], ["onlyTag", /gerektiren vardiyada/],
  ["rules", /^kurallar/], ["icapBal", /icap sayıları dengesiz/], ["icap", /icap/], ["empty", /boş yer/], ["over", /kapasitesinden fazla/], ["unknown", /bilinmeyen kişi/],
  ["gap", /iki nöbet arası/], ["block", /engelli (günde|saatte)|izinli saat dışında/],
];
const famOf = t => (FAM.find(([, re]) => re.test(t)) || ["other"])[0];
/* asla olmaması gerekenler (uygulama bunları her durumda engellemeli) */
const NEVER = new Set(["leave", "noduty", "mesaiDuty", "who", "shNever", "overlap", "unknown", "over", "block", "onlyTag", "icap"]);
const SOFTWARN = new Set(["icapBal"]);   // en iyisi olup olmadığı denetçiyle kanıtlanamaz: yalnız uyarı

function reported(f, rep, dr) {
  const v = (dr.viol || []).join("\n");
  switch (f) {
    case "double": case "rest": case "gap": case "wrOff": return (rep.hard || 0) > 0 || /dinlenme|iki nöbet arası|sonra .* izinli olmalı|aynı anda/.test(v);
    case "must": case "shMust": return (rep.pinMiss || 0) > 0 || /yerleşemedi|kesin/.test(v);
    case "targets": return (rep.tgtMiss || 0) > 0 || /sayı|nöbet yazıldı/.test(v);
    case "nights": return (rep.nightMiss || 0) > 0 || /gece/.test(v);
    case "rhythm": return (rep.rrV || 0) + (rep.rhythmV || 0) > 0 || /ritim|düzen/.test(v);
    case "sen": return (rep.senV || 0) > 0 || /kıdem/i.test(v);
    case "gen": return (rep.genV || 0) > 0 || /kadın|cinsiyet/i.test(v);
    case "rules": return (rep.ruleV || 0) > 0 || /kural/.test(v);
    case "empty": return (dr.emptyCount || 0) > 0 || /boş/.test(v);
    case "icap": return /icap/i.test(v);
    case "mesai": return /mesai/i.test(v);
    default: return false;
  }
}
/* onaylı kesin gün kuralların önüne geçer ve bunu açıkça yazar ("… onaylı kesin nöbet günü … Kesin gün üstün geldi") */
const mustOver = (t, v) => { const m = t.match(/^(.+?) (\d+)\. gün/); return !!(m && v.includes(`${m[1]}: ${m[2]}. gün onaylı kesin nöbet günü`)); };
const wait = ms => new Promise(r => setTimeout(r, ms));
async function idle(E, max = 240000) { const t0 = Date.now(); await wait(150); while (Date.now() - t0 < max) { if (!E("ALT.busy") && !E("RD_BUSY")) return true; await wait(200); } return false; }

(async () => {
  // tohum listesinde "105o" = ek boyutlar olmadan (eski üretici) senaryo
  const seeds = LIST ? LIST.split(",").filter(Boolean) : Array.from({ length: N }, (_, i) => FROM + i);
  let nFail = 0, nDone = 0;
  for (const s0 of seeds) {
    const seed = parseInt(s0, 10), nox = NOX || /o$/.test(String(s0));
    const fx = scenario(seed, { ...(nox ? { noExtra: true } : {}), ...(MONTH ? { month: MONTH } : {}), ...(KISI ? { n: KISI } : {}), ...(MODE ? { mode: MODE } : {}) }), rec = { seed, meta: fx.meta, fails: [], warns: [] };
    const t0 = Date.now();
    try {
      const { E, errors } = await openApp(fx);
      const doSug = (seed * 2654435761 % 1000) / 1000 < PS, doRe = (seed * 40503 % 1000) / 1000 < PR;
      E("showTab('cizelge');generate()");
      rec.tGen = Date.now() - t0;
      if (!E("!!draft")) { rec.fails.push("taslak oluşmadı"); throw 0; }
      if (doSug) { if (!(await idle(E))) rec.warns.push("öneriler 240 sn'de bitmedi"); }
      else E("ALT.token++;ALT.busy=false");
      const dr = E("draft"), rep = dr.rep || {};
      rec.rep = rep; rec.empty = dr.emptyCount; rec.exact = dr.exact;
      const c = check(fx, dr, { targets: true, nights: true });
      const fam = {}; c.problems.forEach(t => { const f = famOf(t); (fam[f] = fam[f] || []).push(t); });
      rec.fam = Object.fromEntries(Object.entries(fam).map(([k, v]) => [k, v.length]));
      for (const f in fam) {
        if (SOFTWARN.has(f)) { rec.warns.push(`[${f}] ${fam[f][0]}`); continue; }
        if (NEVER.has(f)) {
          // onaylı kesin gün kuralların önüne geçer ve bunu açıkça yazar: o durumda ihlal bildirilmiş sayılır
          const v = (dr.viol || []).join("\n"), real = fam[f].filter(t => !mustOver(t, v));
          if (real.length) rec.fails.push(`ASLA OLMAMALI [${f}] ${real.slice(0, 2).join(" | ")}`);
        }
        else if (!reported(f, rep, dr)) rec.fails.push(`SESSİZ İHLAL [${f}] ${fam[f].slice(0, 2).join(" | ")}`);
      }
      // ekranda "Bütün sayılar ve kurallar tutturuldu" yazıyorsa (kesin + uyarı yok) denetçi de temiz bulmalı
      const claim = dr.exact && !(dr.viol || []).some(v => /^(⚠️|❗)/.test(v));
      const hardP = c.problems.filter(t => !SOFTWARN.has(famOf(t)));
      if (claim && hardP.length) rec.fails.push(`"kusursuz" dedi ama denetçi: ${hardP.slice(0, 2).join(" | ")}`);
      if (dr.exact && (rep.pinMiss || 0) > 0) rec.warns.push("exact işareti kesin gün kaçırılmışken de açık");
      // fazla bildirme (uygulama ihlal diyor, denetçi temiz): uyarı olarak say
      if ((rep.ruleV || 0) > 0 && !fam.rules) rec.warns.push(`uygulama ${rep.ruleV} kural ihlali diyor, denetçi bulmadı`);
      if ((rep.senV || 0) > 0 && !fam.sen) rec.warns.push(`uygulama kıdem ${rep.senV} diyor, denetçi bulmadı`);
      if (errors.length) rec.fails.push("JS: " + errors.slice(0, 2).join(" | "));
      // öneriler
      if (doSug) {
        const L = E("ALT.list.map(f=>({k:f.k,parts:f.parts||[f.k],t:f.title,ov:f.ov,ok:f.sc.ok,cost:f.sc.cost,dc:f.sc.dc||[],nSum:f.sc.nSum||0,tg:(f.res.targets||[]).filter(t=>t.sabit&&t.istenen!=null&&t.verilen!==t.istenen).map(t=>t.name),res:f.res}))");
        rec.sug = L.map(f => ({ k: f.k, t: f.t, cost: Math.round(f.cost * 10) / 10 }));
        const issues = E("altAny(draft)");
        if (issues && !L.length) rec.warns.push("sorun var ama hiç öneri yok");
        L.forEach((f, i) => {
          if (f.k === "base") return;
          const { F, o } = applyOv(fx, f.ov);
          const cc = check(F, f.res, { ...o, targets: !o.noTargets, nights: !o.noNights });
          // ana listede "kurallarına uyan yalnızca N yer var → N verildi" diye bildirilen sayı/gece uyuşmazlıkları öneride de aynen kalır
          // (önerinin kendi taslağında da aynı "yalnızca N yer var" uyarısı yazıyorsa o da bildirilmiş sayılır: ör. döngü kapanınca kişi sayıları yeniden geçerli olur)
          const adj = [...(dr.viol || []), ...(f.res.viol || [])].map(v => (v.match(/^⚠️ (.+?): \d+ (gece )?nöbet(i)? yazıldı ama kurallarına uyan yalnızca|^⚠️ (.+?): \d+ gece yazıldı ama toplam nöbeti/) || []).slice(1).find(Boolean)).filter(Boolean);
          const sv = (f.res.viol || []).join("\n");
          // kartta "Sayılar: Ayşe 19 → 22 …" diye açıkça yazılan sayı değişiklikleri sessiz değildir
          const dcN = (f.dc || []).map(x => (x.match(/^(.+) \d+ → \d+$/) || [])[1]).filter(Boolean);
          // "ritim kusursuz kalsın" ve "gece sayılarını program dağıtsın" önerileri kişi sayısını değiştirebilir (uygulama buna izin verir, kartta yazar)
          if ((f.ov || {}).keep || (f.parts || []).includes("nfree")) adj.push(...dcN, ...(f.tg || []));   // kartta "N kişinin yazılı sayısı tutmaz" diye de yazar
          const bad = cc.problems.filter(t => !mustOver(t, sv) && !(o.allowEmpty && /boş yer/.test(t)) && !SOFTWARN.has(famOf(t)) && !(/istendi/.test(t) && adj.some(nm => t.startsWith(nm + ":"))));
          // taslakta zaten olan ve hiçbir önerinin çözemediği kesin gün / katı kural sorunu öneride aynı kalabilir (kartta yazar), artamaz
          const fr = f.res.rep || {}, okPin = (fr.pinMiss || 0) > 0 && (fr.pinMiss || 0) <= (rep.pinMiss || 0), okHard = (fr.hard || 0) > 0 && (fr.hard || 0) <= (rep.hard || 0);
          if ((fr.pinMiss || 0) > (rep.pinMiss || 0) || (fr.hard || 0) > (rep.hard || 0)) rec.fails.push(`ÖNERİ ${i + 1} "${f.t}" taslaktan daha çok katı kural / kesin gün sorunu içeriyor`);
          const bad2 = bad.filter(t => !(okPin && /^(must|shMust)$/.test(famOf(t))) && !(okHard && /^(rest|gap|double|wrOff)$/.test(famOf(t))));
          if (bad2.length) rec.fails.push(`ÖNERİ ${i + 1} "${f.t}" kusursuz dedi ama: ${bad2.slice(0, 2).join(" | ")}`);
        });
        // sıralama mantığı: sorunları çözen, sayıları ve dolu yerleri değiştirmeyen bir öneri varken "aynen kalsın" ya da "boş bırak" önde olmamalı
        if (L.length > 1) {
          const clean = L.slice(1).find(f => f.k !== "base" && f.k !== "keep" && !(f.ov || {}).keep && !(f.dc || []).length && !(f.nSum > 0) && !(f.res.emptyCount > (dr.emptyCount || 0)));   // gece sayılarını değiştiren de "sayı değiştirir"
          if (clean && (L[0].k === "base" || L[0].k === "keep" || (L[0].ov || {}).keep)) rec.warns.push(`SIRALAMA: "${L[0].t}" önde, ama "${clean.t}" sayıları değiştirmeden çözüyor`);
        }
        if (L.length) {
          const sig = JSON.stringify(L[0].res.asg);
          E("altApply(0)");
          if (JSON.stringify(E("draft.asg")) !== sig) rec.fails.push("en iyi öneri uygulanınca liste karttakinden farklı");
          if (!E("draft.alt")) rec.fails.push("öneri uygulandı ama işaret yok");
        }
      }
      // yeniden hazırla: sayılar aynıyken asla kötüleşmez
      if (doRe) {
        const k0 = E("withRunOV(()=>draftKey(draft,fillAll()))");
        E("redraft()"); if (!(await idle(E))) rec.warns.push("yeniden hazırla bitmedi");
        const k1 = E("withRunOV(()=>draftKey(draft,fillAll()))");
        for (let i = 0; i < 7; i++) { if (k1[i] < k0[i]) break; if (k1[i] > k0[i]) { rec.fails.push(`yeniden hazırla kötüleştirdi: ${JSON.stringify(k0.slice(0, 7))} → ${JSON.stringify(k1.slice(0, 7))}`); break; } }
        if (E("RD_BUSY")) rec.fails.push("yeniden hazırla meşgul kaldı");
        if (errors.length) rec.fails.push("JS (yeniden): " + errors.slice(0, 2).join(" | "));
      }
      try { E("ALT.token++;"); } catch (e) {}
    } catch (e) { if (e !== 0) rec.fails.push("HATA: " + String(e && (e.stack || e.message) || e).slice(0, 300)); }
    rec.ms = Date.now() - t0;
    nDone++; if (rec.fails.length) nFail++;
    fs.appendFileSync(OUT, JSON.stringify(rec) + "\n");
    process.stdout.write(`${rec.fails.length ? "✗" : "✓"} #${seed} ${rec.meta.mode} n=${rec.meta.n} ${rec.meta.month} ${Math.round(rec.ms / 100) / 10}sn ${rec.meta.desc} ${rec.fails.length ? "\n   " + rec.fails.join("\n   ") : ""}\n`);
  }
  console.log(`BİTTİ: ${nDone} senaryo, ${nFail} hatalı → ${OUT}`);
  process.exit(0);
})();
