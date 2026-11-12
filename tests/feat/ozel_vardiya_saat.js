// Acil danışma tipi ekip: 08–20 ×2, 20–08 ×2; "saatler eşit (kesin)"; bir kişiye ayın belli günlerinde özel vardiya (08:30–18:00).
// O günlerde diğer vardiyalara girmez, kalan günlerde nöbet tutar; toplam saati diğerleriyle eşit ya da yöneticinin verdiği kadar fazla.
const { openApp, fixture, SH, uid } = require("../lib/harness");
const fails = []; const ok = (c, m) => { console.log((c ? "✓ " : "✗ ") + m); if (!c) fails.push(m); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const WK = [["08:30", "18:00"], ["08:30", "18:00"], ["08:30", "18:00"], ["08:30", "18:00"], ["08:30", "18:00"], null, null];
(async () => {
  for (const dh of [0, 24]) {
    const sh = [SH("Gündüz", "08:00", "20:00", 2, undefined, { mesai: true }), SH("Gece", "20:00", "08:00", 2, undefined, { mesai: true })];
    const people = ["Ayla", "Berk", "Cem", "Derya", "Ece", "Fırat", "Gül"].map(name => ({ name }));
    const opts = { hours_eq: true, rules: [{ id: "an", t: "after", who: { k: "all" }, what: "night", n: 2, hard: true, on: true }], people: { [uid(2)]: { ms: { on: true, d: WK, hol: false, mk: "X", from: 1, to: 12, dh } } } };
    const F = fixture({ shifts: sh, people, opts, dept: { fill_policy: "fill_all" } });
    const { E, errors } = await openApp(F);
    E(`paOf('${uid(2)}').ms.mk=planAy()`);
    ok(E(`!!msOf(members.find(p=>p.id==='${uid(2)}'))`) && E(`onDuty(members.find(p=>p.id==='${uid(2)}'))`), "belli günlü özel vardiya: kişi nöbet listesinde kalıyor");
    E("showTab('cizelge');generate()"); E("ALT.token++;ALT.busy=false");
    const dr = E("draft"); if (!dr) { ok(false, "taslak yok"); continue; }
    const mp = E("JSON.stringify(mesaiPlan())"), M = JSON.parse(mp);
    const blocked = E(`(()=>{const p=members.find(x=>x.id==='${uid(2)}'),o=[];for(let d=1;d<=monthInfo().nDays;d++)if(msBlocks(p,d))o.push(d);return o;})()`);
    ok(blocked.length > 0 && blocked.every(d => d <= 12), `özel vardiya günleri yalnız 1–12 arası hafta içi (${blocked.join(",")})`);
    const onBlocked = blocked.filter(d => (dr.asg[d] || []).some(e => e && e.id === uid(2)));
    ok(!onBlocked.length, "özel vardiya günlerinde diğer vardiyalara yazılmadı " + onBlocked.join(","));
    const later = Object.keys(dr.asg).filter(d => +d > 12 && (dr.asg[d] || []).some(e => e && e.id === uid(2))).length;
    ok(later > 0, `ayın kalanında nöbet tutuyor (${later} gün)`);
    ok(Object.keys(M).every(d => +d <= 12), "özel vardiya mesaisi yalnız seçilen günlerde");
    const H = {}; for (const d in dr.asg) (dr.asg[d] || []).forEach(e => { if (e && e.id) H[e.id] = (H[e.id] || 0) + 12; });
    for (const d in M) M[d].forEach(e => { H[e.id] = (H[e.id] || 0) + 9.5; });
    const others = people.map((p, i) => uid(i + 1)).filter(u => u !== uid(2)).map(u => H[u] || 0);
    const avg = others.reduce((a, b) => a + b, 0) / others.length, b = H[uid(2)] || 0;
    console.log("  saatler:", people.map((p, i) => p.name + " " + (H[uid(i + 1)] || 0)).join(", "));
    ok(Math.max(...others) - Math.min(...others) <= 12, "diğerlerinin saatleri en fazla bir nöbet farkla eşit");
    ok(Math.abs(b - (avg + dh)) <= 12, `özel vardiyalının saati ≈ ortalama ${dh ? "+" + dh : ""} (${b} / ${avg.toFixed(1)})`);
    ok((dr.emptyCount || 0) === 0, "bütün yerler dolu");
    const html = E(`(()=>{return msEditorHTML(members.find(p=>p.id==='${uid(2)}'),'');})()`);
    ok(/belli günlerde/.test(html) && /Diğerleriyle eşit|sa fazla/.test(html), "düzenleyicide gün aralığı ve saat farkı seçimi");
    // özel vardiyadan önceki gece ve gece sonrası izin günleri özel vardiyaya denk gelmez
    const nightBefore = blocked.filter(d => [1, 2].some(k => (dr.asg[d - k] || []).some(e => e && e.id === uid(2) && e.s === 1)));
    ok(!nightBefore.length, "özel vardiyadan önceki iki gün gece nöbeti yok (gece sonrası izin özel vardiyaya denk gelmiyor) " + nightBefore.join(","));
    ok(/özel vardiya/.test(E(`personSub(members.find(p=>p.id==='${uid(2)}'))`)) && !/sabit mesai/.test(E(`personSub(members.find(p=>p.id==='${uid(2)}'))`)), "kişi satırında “özel vardiya” yazıyor, “sabit mesai” değil");
    const freeDay = [20, 21, 22, 23, 24, 25].find(d => !blocked.includes(d));
    ok(E(`withView(draft,planAy(),()=>{editDay=${freeDay};return deWhy(members.find(p=>p.id==='${uid(2)}'),{d:${freeDay},si:0},'')})`) !== "sabit mesai", "gün düzenleyicide özel vardiya dışındaki günde kişi seçilebilir");
    ok(/özel vardiyada/.test(E(`withView(draft,planAy(),()=>{editDay=${blocked[0]};return deWhy(members.find(p=>p.id==='${uid(2)}'),{d:${blocked[0]},si:0},'')})`)), "özel vardiya gününde gerekçe yazıyor");
    // takas: özel vardiya günü ve önceki gece olmaz
    const sw = E(`withView(draft,planAy(),()=>[swapHardReason(${blocked[1]},{id:'x',s:0},members.find(p=>p.id==='${uid(2)}')),swapHardReason(${blocked[1] - 1},{id:'x',s:1},members.find(p=>p.id==='${uid(2)}'))])`);
    ok(/mesai/.test(sw[0]) && /(mesai|uç uca|zaten|çakış)/.test(sw[1]), "takas: özel vardiya günü ve önceki gece kabul edilmez (" + sw.join(" / ") + ")");
    if (errors.length) { console.log(errors.slice(0, 3)); fails.push("js"); }
  }
  // tablo: izin işareti görüntülenen ayın isteklerinden gelir
  {
    const sh = [SH("Gündüz", "08:00", "20:00", 1), SH("Gece", "20:00", "08:00", 1)];
    const F = fixture({ shifts: sh, people: [{ name: "Ayla" }, { name: "Berk" }, { name: "Cem" }], prefs: { 0: { 3: "izin" } } });
    const { E, errors } = await openApp(F);
    E("showTab('cizelge');generate()"); E("ALT.token++;ALT.busy=false");
    const a = E(`withView(draft,planAy(),()=>gridData().rows.find(r=>r.p.id==='${uid(1)}').cells[2])`);
    E(`prefsAll['2026-01']={'${uid(1)}':{5:'izin'}}`);
    const b = E(`withView({...draft,asg:{},mesai:null},'2026-01',()=>{const r=gridData().rows.find(r=>r.p.id==='${uid(1)}');return [r.cells[2],r.cells[4]];})`);
    ok(a === "İ" && b[0] === "X" && b[1] === "İ", `tablo: izin o ayın isteğinden (${a} · ${b.join(",")})`);
    if (errors.length) { console.log(errors.slice(0, 3)); fails.push("js"); }
  }
  // saatler eşit (kesin) tutamıyorsa taslak açıkça yazar
  {
    const sh = [SH("Gündüz", "08:00", "20:00", 2), SH("Gece", "20:00", "08:00", 2)];
    const people = ["Ayla", "Berk", "Cem", "Derya", "Ece", "Fırat", "Gül"].map(name => ({ name }));
    const iz = {}; for (let d = 1; d <= 18; d++) iz[d] = "izin";
    const F = fixture({ shifts: sh, people, opts: { hours_eq: true }, prefs: { 0: iz }, dept: { fill_policy: "fill_all" } });
    const { E, errors } = await openApp(F);
    E("showTab('cizelge');generate()"); E("ALT.token++;ALT.busy=false");
    const v = E("(draft.viol||[]).join('\\n')");
    ok(/Aylık saatler eşit değil/.test(v) && /Ayla/.test(v), "18 gün izinli kişi eşit saate ulaşamıyor: taslak bunu yazıyor");
    if (errors.length) { console.log(errors.slice(0, 3)); fails.push("js"); }
  }
  console.log("SONUÇ:", fails.length ? fails.length + " hata: " + fails.join(" / ") : "TAMAM"); process.exit(0);
})();
