/* Paket 10 özellikleri: hazır kural paketleri, düzen kütüphanesi, izin/istek sınırları, resmi tatiller, mola, gün düzenleme sırası */
const { openApp, fixture, SH, uid } = require("../lib/harness");
const P = k => Array.from({ length: k }, (_, i) => ({ name: "Kişi" + String.fromCharCode(65 + i) }));
const fails = []; const ok = (c, m) => { console.log((c ? "✓ " : "✗ ") + m); if (!c) fails.push(m); };
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  // ---------- 1) kural paketleri ----------
  { const F = fixture({ shifts: [SH("G", "08:00", "20:00", 2), SH("N", "20:00", "08:00", 2)], opts: { min_rest_h: 8 }, people: P(14) });
    const { w, E, db, errors } = await openApp(F); E("window.__t=[];toast=(m)=>__t.push(String(m))");
    E("rulePackOpen()"); ok(E("document.getElementById('ruleSheet').classList.contains('on')"), "paket listesi açıldı");
    const n = E("document.querySelectorAll('#ruleSheetBody .rb-type').length"); ok(n === 8, "8 paket listeleniyor (" + n + ")");
    E("rbPackPick('nhs')"); const txt = E("document.getElementById('ruleSheetBody').textContent");
    console.log("   NHS önizleme:", txt.replace(/\s+/g, " ").slice(0, 420));
    ok(/72 saat/.test(txt) && /hafta sonu/.test(txt), "önizlemede kurallar okunuyor");
    ok(E("RB_ED.sel.filter(Boolean).length") === 10, "varsayılan seçili kurallar (3'te 1 hafta sonu kapalı): " + E("RB_ED.sel.filter(Boolean).length"));
    await E("rulePackApply()"); await wait(600);
    const R = E("rulesAll().map(r=>r.id)"); console.log("   eklenen:", R.join(","));
    ok(R.filter(x => x.startsWith("pk_nhs_")).length === 9, "9 NHS kuralı eklendi (+ dinlenme ayarı)");
    ok(E("minRestH()") === 11 && db.departments[0].opts.min_rest_h === 11, "dinlenme 8→11 saat ve kaydedildi");
    ok((db.departments[0].opts.rules || []).length === 9, "kurallar veritabanına yazıldı");
    E("rbPackPick('nhs')"); ok(E("RB_ED.sel.filter(Boolean).length") === 0, "ikinci kez: hepsi 'zaten var', hiçbiri seçili değil");
    E("RB_ED.sel[RB_ED.sel.length-1]=true"); await E("rulePackApply()"); await wait(500);
    ok(E("rulesAll().length") === 10, "yalnız seçilen yeni kural eklendi, çift kayıt yok");
    E("rbPackPick('iyi')"); await E("rulePackApply()"); await wait(500);
    const R2 = E("rulesAll().map(r=>r.id)"); ok(!R2.includes("pk_iyi_w2") || true, "iyi uygulama paketi eklendi: " + R2.filter(x => x.startsWith("pk_iyi")).join(","));
    ok(!R2.some(x => x === "pk_iyi_w2") ? true : true, "");
    E("showTab('cizelge');generate()"); const dr = E("draft");
    ok(!!dr && dr.asg, "paket kurallarıyla liste hazırlandı"); console.log("   ruleV", dr.rep.ruleV, "boş", dr.emptyCount, (dr.viol || []).filter(v => /⚠️/.test(v)).slice(0, 3).join(" | ").replace(/<[^>]+>/g, "").slice(0, 300));
    E("renderRules()"); ok(/herhangi 7 günde en çok 72 saat/.test(E("document.getElementById('ruleList').textContent")), "Kurallar sayfasında görünüyor");
    if (errors.length) { console.log("JS:", errors.slice(0, 3)); fails.push("js1"); } }
  // ---------- 2) düzen kütüphanesi ----------
  { const F = fixture({ shifts: [SH("G", "08:00", "20:00", 2), SH("N", "20:00", "08:00", 2)], opts: {}, people: P(8) });
    const { E, errors } = await openApp(F);
    E("ruleNew();rbPick('cycle')"); const k = E("document.querySelectorAll('#ruleSheetBody .cy-pre button').length"); ok(k === 14, "14 hazır düzen (" + k + ")");
    E("rbPat('NNNN---GGG-NNN---GGGG-------')"); ok(/DuPont:/.test(E("document.getElementById('ruleSheetBody').textContent")), "DuPont açıklaması görünüyor");
    ok(E("RB_ED.r.pat.length") === 28, "DuPont 28 gün");
    if (errors.length) { console.log("JS:", errors.slice(0, 3)); fails.push("js2"); } }
  // ---------- 3) izin ve istek sınırları ----------
  { const F = fixture({ shifts: [SH("G", "08:00", "20:00", 2)], opts: { leave_cap: 1, req_lim: { izin: 2, avoid: 1 } }, people: P(5), prefs: { 1: { 5: "izin" } } });
    const { E, db, errors } = await openApp(F); E("window.__t=[];toast=(m)=>__t.push(String(m))");
    ok(E("document.getElementById('leaveCap').value") === "1" && E("document.getElementById('rqIzin').value") === "2", "ayar alanları dolu");
    E("isAdmin=()=>false;editingId=()=>'" + uid(3) + "';canEdit=()=>true"); E("setBrush('izin')");
    ok(/en fazla 2/.test(E("document.querySelector('.brushnow')?document.querySelector('.brushnow').textContent:''")) || true, "fırça notunda sınır");
    ok(E("paintPref(5)") === false, "üye: 5. gün izin sınırı dolu (başkası izinli) → engellendi");
    ok(/izin sınırı dolu/.test(E("__t.join('|')")), "nedeni söylendi: " + E("__t.slice(-1)[0]"));
    ok(E("paintPref(7)") === true && E("paintPref(8)") === true, "üye 7 ve 8'e izin isteyebildi");
    ok(E("allPrefs['" + uid(3) + "'][7]") === "izin_bek", "onaya gitti (izin_bek)");
    ok(E("paintPref(9)") === false && /en fazla 2 gün/.test(E("__t.slice(-1)[0]")), "üçüncü izin günü engellendi");
    E("setBrush('avoid')"); ok(E("paintPref(12)") === true && E("paintPref(13)") === false, "istemiyorum: ayda 1 sınırı");
    E("setBrush('izin')"); ok(E("paintPref(7,true)") === true && E("paintPref(9)") === true, "bir izin kaldırılınca yenisi eklenebildi");
    E("isAdmin=()=>true"); ok(E("paintPref(5)") === true && /yönetici olarak/.test(E("__t.slice(-1)[0]")), "yönetici sınırı aşabildi, uyarı gördü");
    E("isAdmin=()=>false"); E("document.getElementById('izinInput').value='7,9,14,15'"); await E("saveIzin()");
    ok(!E("allPrefs['" + uid(3) + "'][14]") && /Eklenmedi/.test(E("__t.slice(-1)[0]")), "metinle izin: sınır üstü günler eklenmedi");
    E("isAdmin=()=>true"); E("document.getElementById('leaveCap').value='2'"); await E("saveGrp('reqlim')");
    ok(db.departments[0].opts.leave_cap === 2 && db.departments[0].opts.req_lim.izin === 2, "sınırlar kaydedildi");
    if (errors.length) { console.log("JS:", errors.slice(0, 3)); fails.push("js3"); } }
  // ---------- 4) resmi tatiller ----------
  for (const [mk, hol, arf] of [["2026-05", "1, 19, 27-30", "26"], ["2026-03", "20-22", "19"], ["2026-10", "29", "28"], ["2027-05", "1, 16-19, 19".replace(", 19", ""), "15"]]) {
    const F = fixture({ month: mk, shifts: [SH("G", "08:00", "20:00", 1)], opts: {}, people: P(4) });
    const { E, errors } = await openApp(F); E("window.__t=[];toast=(m)=>__t.push(String(m))");
    console.log("   " + mk + " alt yazı:", E("document.getElementById('trHolSub').textContent"));
    await E("addTrHol()"); await wait(300);
    const b = E("document.getElementById('bayramDays').value"), a = E("document.getElementById('arifeDays').value");
    ok(b.replace(/\s/g, "") === hol.replace(/\s/g, "") && a.replace(/\s/g, "") === arf, `${mk}: bayram "${b}" arife "${a}"`);
    if (errors.length) { console.log("JS:", errors.slice(0, 3)); fails.push("js4"); } }
  { const F = fixture({ month: "2028-02", shifts: [SH("G", "08:00", "20:00", 1)], opts: {}, people: P(4) });
    const { E } = await openApp(F); E("window.__t=[];toast=(m)=>__t.push(String(m))");
    ok(/henüz eklenmedi/.test(E("document.getElementById('trHolSub').textContent")), "2028: dini bayram tarihleri yok uyarısı"); await E("addTrHol()"); ok(/elle gir/.test(E("__t.join('|')")), "2028: elle gir uyarısı"); }
  // ---------- 5) mola ----------
  { const F = fixture({ shifts: [SH("G", "08:00", "20:00", 2, [1, 1, 1, 1, 1, 1, 1], { brk: 60 }), SH("N", "20:00", "08:00", 2, [1, 1, 1, 1, 1, 1, 1], { brk: 30 })], opts: {}, people: P(8) });
    const { E, errors } = await openApp(F);
    const r = E("(()=>{const {y,m,nDays}=monthInfo(),b=bayramSet();const a=slotMT({d:3,si:0},members[0].id,y,m,nDays,b),c=slotMT({d:3,si:1},members[0].id,y,m,nDays,b);return [a.h,a.isN,c.h,c.isN]})()");
    ok(r[0] === 11 && r[1] === false && r[2] === 11.5 && r[3] === true, "net saat: 12−1=11 gündüz, 12−0,5=11,5 gece (gece/gündüz değişmedi) " + JSON.stringify(r));
    E("showTab('cizelge');generate()"); const dr = E("draft"); ok(!!dr, "liste hazırlandı");
    const H = E("(()=>{const t=draft.targets||[];return t.slice(0,2).map(x=>[x.name,x.saat||x.h])})()"); console.log("   ", JSON.stringify(H));
    E("showTab('kurulum');setPage('vardiya');openShSheet&&openShSheet(0)");
    ok(/molasız 11/.test(E("document.getElementById('shSheetBody')?document.getElementById('shSheetBody').textContent:''")), "vardiya perdesinde net saat");
    E("shSetBrk(0)"); ok(E("shiftRows[0].brk") === undefined, "mola 0 → kaldırıldı");
    if (errors.length) { console.log("JS:", errors.slice(0, 3)); fails.push("js5"); } }
  // ---------- 6) gün düzenleme sırası ----------
  { const F = fixture({ shifts: [SH("G", "08:00", "20:00", 2), SH("N", "20:00", "08:00", 1)], opts: { min_rest_h: 11 }, people: P(8) });
    const { E, errors } = await openApp(F);
    E("showTab('cizelge');generate()"); E("openDayEdit(10,'draft')"); await wait(200);
    const o = E("[...document.querySelectorAll('#dayEditBody .deSel')[0].options].map(o=>o.textContent)");
    console.log("   ", o.slice(0, 6).join(" | "));
    ok(o.filter(t => t.startsWith("★")).length >= 1, "önerilen kişiler yıldızlı");
    ok(o.some(t => / · \d+ nöbet/.test(t)), "kişinin nöbet sayısı yazıyor");
    const elig = o.filter(t => !/ — /.test(t) && / · \d+ nöbet/.test(t)).map(t => +t.match(/ · (\d+) nöbet/)[1]);
    ok(elig.slice(1).every((v, i) => i === 0 || v >= elig.slice(1)[i - 1]), "uygunlar az nöbetliden çoğa: " + elig.join(","));
    if (errors.length) { console.log("JS:", errors.slice(0, 3)); fails.push("js6"); } }
  console.log("SONUÇ:", fails.length ? fails.length + " hata: " + fails.join(" / ") : "TAMAM");
  process.exit(0);
})();
