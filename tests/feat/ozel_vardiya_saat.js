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
    const opts = { hours_eq: true, people: { [uid(2)]: { ms: { on: true, d: WK, hol: false, mk: "X", from: 1, to: 12, dh } } } };
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
    if (errors.length) { console.log(errors.slice(0, 3)); fails.push("js"); }
  }
  console.log("SONUÇ:", fails.length ? fails.length + " hata: " + fails.join(" / ") : "TAMAM"); process.exit(0);
})();
