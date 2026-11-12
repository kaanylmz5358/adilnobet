/* Önceki ayın son günleri (kuyruk) kurallarda doğru sayılıyor mu */
const { openApp, fixture, SH, uid } = require("../lib/harness");
const P = k => Array.from({ length: k }, (_, i) => ({ name: "Kişi" + String.fromCharCode(65 + i) }));
// Kasım 2026: 30 gün. A: 28-29-30 gece; B: 30 gece; C: 24..30 her gün gündüz; D: 28 Cmt gündüz
const nov = {}; for (let d = 1; d <= 30; d++) nov[d] = [];
[28, 29, 30].forEach(d => nov[d].push({ id: uid(1), s: 1 }));
nov[30].push({ id: uid(2), s: 1 });
for (let d = 24; d <= 30; d++) nov[d].push({ id: uid(3), s: 0 });
nov[28].push({ id: uid(4), s: 0 });
const fails = []; const ok = (c, m) => { console.log((c ? "✓ " : "✗ ") + m); if (!c) fails.push(m); };
(async () => {
  for (const variant of ["hard", "soft"]) {
    const hard = variant === "hard";
    const F = fixture({ month: "2026-12", shifts: [SH("G", "08:00", "20:00", 1), SH("N", "20:00", "08:00", 1)],
      opts: { min_rest_h: 0, rules: [
        { id: "a", t: "after", who: { k: "all" }, what: "night", n: 2, hard },
        { id: "q", t: "seq", who: { k: "all" }, fa: "N", fb: "D", hard },
        { id: "o", t: "lim", who: { k: "all" }, op: "min", n: 1, what: "off", per: "roll", win: 7, hard },
        { id: "w", t: "lim", who: { k: "all" }, op: "max", n: 1, what: "weekend", per: "row", hard }] },
      people: P(8), schedules: [{ month: "2026-11", data: { mode: "shifts", asg: nov } }] });
    // 1-2 Aralık için A/B/C/D'yi kışkırt: hepsi "yes" istesin
    F.db.prefs = F.db.prefs || [];
    const { w, E, errors } = await openApp(F);
    E("generate()"); const dr = E("draft");
    const on = (i, d) => (dr.asg[d] || []).find(e => e.id === uid(i) && !e.ic);
    console.log(`— ${variant}: ruleV=${dr.rep.ruleV} viol=${(dr.viol || []).filter(v => /⚠️/.test(v)).length}`);
    // A 28-30 Kasım gece çalıştı: art arda gece sınırı yok → ya gece bloğu sürer (1 Aralık gece) ya da 1-2 Aralık izinli
    { const a1 = on(1, 1), a2 = on(1, 2); ok(a1 ? a1.s === 1 : !a2, `${variant}: A (son 3 gece) gece bloğu sürüyor ya da 1-2 Aralık izinli`); }
    ok(!(on(2, 1) && !E(`isNightShift(shiftRows[${on(2, 1) ? on(2, 1).s : 0}])`)), `${variant}: B (30 Kasım gece) 1 Aralık gündüz değil`);
    { const b1 = on(2, 1), b2 = on(2, 2); console.log("    B 1-2:", JSON.stringify(b1), JSON.stringify(b2)); ok(b1 ? b1.s === 1 : !b2, `${variant}: B gece sonrası: ya gece bloğu sürüyor ya da 2 gün izin`); }
    ok(!on(3, 1), `${variant}: C (24–30 Kasım her gün) 1 Aralık boş`);
    ok(!on(4, 5) && !on(4, 6), `${variant}: D (28 Kasım hafta sonu) 5-6 Aralık hafta sonu çalışmıyor`);
    ok(dr.rep.ruleV === 0, `${variant}: kural ihlali yok`);
    // değerlendirici doğrudan: A'yı 1 Aralık'a yaz → ihlal sayılmalı
    const r = E(`(()=>{const slots=buildSlots(),{y,m,nDays}=monthInfo();const C=rulesCompile(slots,slots.map(()=>members.map(()=>null)),y,m,nDays,null);
      const A=slots.map(()=>-1);const s1=slots.findIndex(s=>s.d===1&&s.si===0),s5=slots.findIndex(s=>s.d===5&&s.si===0);
      const iA=members.findIndex(p=>p.id==='${uid(1)}'),iD=members.findIndex(p=>p.id==='${uid(4)}');A[s1]=iA;A[s5]=iD;const e=ruleEval(C,A,true);return {per:e.per,det:e.det.map(x=>x.txt)}})()`);
    ok(r.per.a >= 1, `${variant}: değerlendirici A'nın 1 Aralık nöbetini gece sonrası izin ihlali sayıyor`);
    ok(r.per.q >= 1, `${variant}: değerlendirici gece→gündüz sırasını sayıyor`);
    ok(r.per.w >= 1, `${variant}: değerlendirici art arda hafta sonunu sayıyor`);
    console.log("   ", r.det.slice(0, 4).join(" | "));
    if (errors.length) { console.log("JS:", errors.slice(0, 2)); fails.push("js"); }
  }
  console.log("SONUÇ:", fails.length ? fails.length + " hata" : "TAMAM");
  process.exit(0);
})();
