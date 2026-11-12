// Yöneticinin yazdığı kesin sayılar: toplam yer sayısını tutuyorsa herkes tam yazılan sayıyı alır
// (kurallar, dilekler ve "vardiyayı eşit dağıt" kuralı sayıyı kaydırmaz).
const { openApp, fixture, SH } = require("../lib/harness");
const fails = []; const ok = (c, m) => { console.log((c ? "✓ " : "✗ ") + m); if (!c) fails.push(m); };
(async () => {
  {
    const sh = [SH("Gündüz", "08:00", "20:00", 2), SH("Gece", "20:00", "08:00", 2)];
    const T = [18, 17, 17, 17, 17, 17, 17];            // 30 gün × 4 = 120
    const people = ["Ayla", "Berk", "Cem", "Derya", "Ece", "Fırat", "Gül"].map((name, i) => ({ name, target: T[i] }));
    const prefs = { 0: { 3: "avoid", 4: "avoid", 10: "yes" }, 2: { 7: "yes", 8: "yes", 9: "yes", 10: "yes" }, 4: { 20: "avoid", 21: "avoid", 22: "avoid" } };
    const opts = { rules: [{ id: "an", t: "after", who: { k: "all" }, what: "night", n: 2, hard: true, on: true }, { id: "eq", t: "eq", who: { k: "all" }, si: 1, on: true }] };
    for (let k = 0; k < 3; k++) {
      const F = fixture({ shifts: sh, people, prefs, opts, dept: { fill_policy: "fill_all" } });
      const { E, errors } = await openApp(F);
      E("showTab('cizelge');generate()"); E("ALT.token++;ALT.busy=false");
      const t = E("draft.targets.filter(x=>x.sabit).map(x=>x.istenen+'→'+x.verilen)");
      ok(E("draft.rep.tgtMiss") === 0, `#${k} yazılı sayılar tam tuttu (${t.join(" ")})`);
      if (errors.length) { console.log(errors.slice(0, 3)); fails.push("js"); }
    }
  }
  console.log("SONUÇ:", fails.length ? fails.length + " hata: " + fails.join(" / ") : "TAMAM"); process.exit(0);
})();
