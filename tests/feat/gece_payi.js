// Kişi kartında kesin gece sayısı yazılı, toplam sayıyı program hesaplıyor (yarı zamanlı oran / izne oranlı pay):
// program payı gece sayısından küçük çıkarsa pay geceyi karşılayacak kadar artmalı; gece sayısı sessizce düşürülmemeli.
const { openApp, fixture, SH, uid } = require("../lib/harness");
const { check } = require("../lib/checker");
const fails = []; const ok = (c, m) => { console.log((c ? "✓ " : "✗ ") + m); if (!c) fails.push(m); };
(async () => {
  const sh = [SH("Sabah", "08:00", "16:00", 1), SH("Akşam", "16:00", "24:00", 1), SH("Gece", "00:00", "08:00", 1)];
  const people = ["Ayla", "Berk", "Cem", "Derya", "Ece", "Fırat"].map(name => ({ name }));
  people[1].night = 9;                                  // Berk: kesin 9 gece
  const opts = { people: { [uid(2)]: { ratio: 40 } } }; // Berk %40 çalışıyor → programın payı ~6-7
  const F = fixture({ shifts: sh, people, opts });
  for (let r = 0; r < 2; r++) {
    const { E, errors } = await openApp(F);
    E("showTab('cizelge');generate()"); E("ALT.token++;ALT.busy=false");
    const dr = E("draft"); if (!dr) { ok(false, "taslak oluşmadı"); break; }
    const id = uid(2); let tot = 0, nights = 0;
    for (const d in dr.asg) (dr.asg[d] || []).forEach(e => { if (e && e.id === id && !e.ic) tot++; });
    nights = (dr.nc || {})[id] || 0;   // uygulamanın kendi gece tanımıyla (denetçi ayrıca bakıyor)
    const v = (dr.viol || []).filter(x => /Berk/.test(x));
    ok(nights === 9, `Berk 9 gece istedi, ${nights} gece aldı (toplam ${tot})`);
    ok(tot >= 9 && tot <= 12, `Berk'in toplamı geceyi karşılıyor ama oranından çok aşmıyor: ${tot}`);
    ok(!v.some(x => /indirildi/.test(x)), "gece sayısı düşürüldü uyarısı yok: " + (v.join(" | ") || "—"));
    const c = check(F, dr, { targets: true, nights: true });
    ok(!c.problems.some(t => /gece istendi/.test(t)), "denetçi: gece sayıları tuttu " + (c.problems.filter(t => /gece/.test(t)).slice(0, 2).join(" | ") || ""));
    if (errors.length) { console.log(errors.slice(0, 3)); fails.push("js"); }
  }
  console.log("SONUÇ:", fails.length ? fails.length + " hata: " + fails.join(" / ") : "TAMAM"); process.exit(0);
})();
