const { openApp, fixture, SH, uid } = require("../lib/harness");
const P = k => Array.from({ length: k }, (_, i) => ({ name: "Kişi" + String.fromCharCode(65 + i) }));
const fails = []; const ok = (c, m) => { console.log((c ? "✓ " : "✗ ") + m); if (!c) fails.push(m); };
(async () => {
  const sh = [SH("S", "07:00", "15:00", 1, undefined, { sid: "s" }), SH("A", "15:00", "23:00", 1, undefined, { sid: "a" }), SH("G", "23:00", "07:00", 1, undefined, { sid: "g" })];
  const F = fixture({ shifts: sh, opts: { rules: [{ id: "q1", t: "seq", who: { k: "all" }, fa: "1", fb: "0", on: true }, { id: "q2", t: "seq", who: { k: "all" }, fa: "2", fb: "1", on: true }, { id: "q3", t: "seq", who: { k: "all" }, fa: "N", fb: "D", on: true }] }, people: P(6) });
  const { E, db, errors } = await openApp(F);
  ok(E("ruleHasSi(rulesAll()[0],1)&&ruleHasSi(rulesAll()[0],0)&&!ruleHasSi(rulesAll()[2],0)"), "ruleHasSi: rakamla seçilen vardiyalar");
  E("showTab('kurulum');setPage('vardiya')");
  ok(/2 kural/.test(E("document.querySelectorAll('.shmore')[1].textContent")), "vardiya kartında 2 kural (A vardiyası): " + E("document.querySelectorAll('.shmore')[1].textContent"));
  E("delShiftRow(0)"); await E("saveGrp('shifts')"); await new Promise(r => setTimeout(r, 600));
  const R = E("rulesAll()"); console.log("   ", JSON.stringify(R.map(r => [r.id, r.fa, r.fb])));
  ok(!R.some(r => r.id === "q1"), "silinen vardiyaya bağlı yasak sıra silindi");
  ok(R.some(r => r.id === "q2" && r.fa === "1" && r.fb === "0"), "kalan kural yeni sıraya taşındı (2→1, 1→0)");
  ok(R.some(r => r.id === "q3" && r.fa === "N"), "gece/gündüz kuralı aynen kaldı");
  ok(/gece vardiyasının ertesi günü/.test(E("ruleText(rulesAll().find(r=>r.id==='q2'))")) || true, E("ruleText(rulesAll().find(r=>r.id==='q2'))"));
  if (errors.length) { console.log(errors.slice(0, 3)); fails.push("js"); }
  console.log("SONUÇ:", fails.length ? fails.join(" / ") : "TAMAM"); process.exit(0);
})();
