/* Ekip döngüsü (A/B/C/D): gerçekçi kurulumda döngü tam tutmalı; kalabalık ekipte nöbetler eşit paylaşılmalı. */
const { openApp, fixture, SH, uid } = require("../lib/harness");
const { check } = require("../lib/checker");
const ok = (c, m) => { console.log((c ? "✓ " : "✗ ") + m); if (!c) process.exitCode = 1; };
const teams = (k, per, pat, base, step, off = 1) => Array.from({ length: k }, (_, t) => ({ id: "c" + t, t: "cycle", who: { k: "p", ids: Array.from({ length: per }, (_, j) => uid(off + 1 + t * per + j)) }, pat, start: new Date(Date.UTC(...base) + t * step * 864e5).toISOString().slice(0, 10) }));
(async () => {
  // 1) 4 ekip × 2 kişi, gündüz 2 + gece 2, GGNN---- ; ekipler 2 gün kaydırmalı → her gün 1 ekip gündüz, 1 ekip gece
  {
    const people = [{ name: "Yönetici", noDuty: true }, ...Array.from({ length: 8 }, (_, i) => ({ name: "Hemşire " + (i + 1) }))];
    const fx = fixture({ month: "2026-12", shifts: [SH("Gündüz", "08:00", "20:00", 2, undefined, { sid: "i0" }), SH("Gece", "20:00", "08:00", 2, undefined, { sid: "i1" })],
      opts: { min_rest_h: 11, rules: teams(4, 2, "GGNN----", [2026, 10, 1], 2) }, people, prefs: {} });
    const { E, errors } = await openApp(fx); E("showTab('cizelge');generate();ALT.token++;ALT.busy=false");
    const dr = E("draft"), c = check(fx, dr, {});
    ok(dr.rep.ruleV === 0 && dr.emptyCount === 0, `4 ekip GGNN----: döngü ihlali ${dr.rep.ruleV}, boş ${dr.emptyCount}`);
    const cnt = Object.values(dr.cnt).filter((v, i) => i); const vs = fx.db.memberships.slice(1).map(m => dr.cnt[m.user_id]);
    ok(Math.max(...vs) - Math.min(...vs) <= 1, `nöbet sayıları ${vs.join(",")}`);
    ok(!c.problems.length, "denetçi: " + (c.problems.slice(0, 3).join(" | ") || "temiz"));
    ok(!errors.length, "JS hatası yok");
  }
  // 2) aynı kurulum + izinler: izin günleri dışında döngü tutmalı, boşlar başkasıyla dolmalı
  {
    const people = [{ name: "Yönetici", noDuty: true }, ...Array.from({ length: 8 }, (_, i) => ({ name: "Hemşire " + (i + 1) })), { name: "Yedek 1" }, { name: "Yedek 2" }];
    const iz = (a, b) => { const o = {}; for (let d = a; d <= b; d++) o[d] = "izin"; return o; };
    const fx = fixture({ month: "2026-12", shifts: [SH("Gündüz", "08:00", "20:00", 2, undefined, { sid: "i0" }), SH("Gece", "20:00", "08:00", 2, undefined, { sid: "i1" })],
      opts: { min_rest_h: 11, rules: [...teams(4, 2, "GGNN----", [2026, 10, 1], 2), { id: "y", t: "cycle", who: { k: "p", ids: [uid(10), uid(11)] }, pat: "GN--", start: "2026-11-01" }] }, people, prefs: { 1: iz(10, 16), 5: iz(3, 5) } });
    const { E, errors } = await openApp(fx); E("showTab('cizelge');generate();ALT.token++;ALT.busy=false");
    const dr = E("draft"), c = check(fx, dr, { allowRules: true });
    ok(dr.emptyCount === 0, `izinli ekip döngüsü: boş ${dr.emptyCount}, döngü sapması ${dr.rep.ruleV}`);
    ok(!c.problems.length, "denetçi (kural sapmaları hariç): " + (c.problems.slice(0, 3).join(" | ") || "temiz"));
    ok(!errors.length, "JS hatası yok");
  }
  // 3) kalabalık ekip: 2 ekip × 7 kişi, günde 2 yer → döngü tutamaz ama nöbetler eşit paylaşılmalı ve nedeni yazılmalı
  {
    const people = [{ name: "Yönetici", noDuty: true }, ...Array.from({ length: 14 }, (_, i) => ({ name: "Kişi " + (i + 1), target: i % 3 ? 4 : undefined }))];
    const fx = fixture({ month: "2027-02", shifts: [SH("Gündüz", "08:00", "20:00", 2, undefined, { sid: "i0" })],
      opts: { min_rest_h: 8, rules: teams(2, 7, "GGGG---", [2026, 9, 15], 4) }, people, prefs: {} });
    const { E, errors } = await openApp(fx); E("showTab('cizelge');generate()");
    for (let i = 0; i < 600; i++) { await new Promise(r => setTimeout(r, 200)); if (!E("ALT.busy")) break; }
    const dr = E("draft"), vs = fx.db.memberships.slice(1).map(m => dr.cnt[m.user_id]);
    ok(Math.max(...vs) - Math.min(...vs) <= 2, `kalabalık ekip eşit: ${vs.join(",")}`);
    ok((dr.viol || []).some(v => /Döngü kuralı ekibin tamamını kapsadığı için/.test(v)), "yazılan sayıların uygulanmadığı söyleniyor");
    const why = E("ALT.why&&ALT.why.txt||''");
    ok(/Ekip döngülerine göre/.test(why) || /döngü/i.test((dr.viol || []).join(" ")), "neden açıklanıyor: " + String(why).replace(/<[^>]+>/g, "").slice(0, 120));
    ok(!errors.length, "JS hatası yok");
  }
  process.exit();
})();
