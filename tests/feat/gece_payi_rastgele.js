// Rastgele ekiplerde kesin gece sayısı + programın hesapladığı pay (yarı zamanlı oran, izin): gece sayısı ya tutar
// ya da uygulama nedenini yazar; bütün yerler dolu kalır; denetçi sessiz bir sorun bulmaz.
const { openApp, fixture, SH, uid } = require("../lib/harness");
const { check } = require("../lib/checker");
const fails = []; const ok = (c, m) => { console.log((c ? "✓ " : "✗ ") + m); if (!c) fails.push(m); };
let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }, ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const NAMES = ["Ayla", "Berk", "Cem", "Derya", "Ece", "Fırat", "Gül", "Hakan", "İpek", "Kaan"];
(async () => {
  for (let t = 0; t < 8; t++) {
    const n = ri(5, 10), sh = [SH("Sabah", "08:00", "16:00", 1), SH("Akşam", "16:00", "24:00", 1), SH("Gece", "00:00", "08:00", 1)];
    const people = NAMES.slice(0, n).map(name => ({ name })), opts = { people: {} }, prefs = {};
    const share = 90 / n;
    for (let k = 0; k < 2; k++) opts.people[uid(ri(1, n))] = { ratio: [40, 50, 60, 80][ri(0, 3)] };
    const nightPeople = new Set(); for (let k = 0; k < ri(1, 3); k++) { const i = ri(0, n - 1); nightPeople.add(i); people[i].night = ri(2, Math.ceil(share)); }
    { const i0 = [...nightPeople][0]; opts.people[uid(i0 + 1)] = { ratio: 40 }; people[i0].night = Math.ceil(share * 0.7); }   // payı geceden küçük kalacak biri
    for (let k = 0; k < 2; k++) { const i = ri(0, n - 1), d0 = ri(1, 24), days = {}; for (let d = d0; d < d0 + ri(2, 6); d++) days[d] = "izin"; prefs[i] = days; }
    const F = fixture({ shifts: sh, people, opts, prefs, dept: { fill_policy: "fill_all" } });
    const { E, errors } = await openApp(F);
    E("showTab('cizelge');generate()"); E("ALT.token++;ALT.busy=false");
    const dr = E("draft"); if (!dr) { ok(false, `#${t} taslak oluşmadı`); continue; }
    const v = (dr.viol || []).join("\n");
    const c = check(F, dr, { targets: true, nights: true });
    const nightBad = c.problems.filter(x => /gece istendi/.test(x));
    const silent = nightBad.filter(x => { const nm = x.split(":")[0]; return !new RegExp(nm + ".*gece|Gece sayısı tutmadı").test(v); });
    ok(!silent.length, `#${t} n=${n}: gece sayıları tuttu ya da nedeni yazıldı ${silent.slice(0, 2).join(" | ")}`);
    ok((dr.emptyCount || 0) === 0 || /boş/.test(v), `#${t} bütün yerler dolu (boş ${dr.emptyCount || 0})`);
    const other = c.problems.filter(x => !/gece istendi|nöbet istendi|kural|ritim|kıdem|kadın/.test(x));
    ok(!other.length, `#${t} denetçi: kesin kurallar temiz ${other.slice(0, 2).join(" | ")}`);
    const lower = /Gece sayısı \d+'?[a-z]* indirildi/.test(v);
    ok(!lower, `#${t} programın payı yüzünden gece düşürülmedi`);
    if (errors.length) { console.log(errors.slice(0, 3)); fails.push("js"); }
  }
  console.log("SONUÇ:", fails.length ? fails.length + " hata: " + fails.join(" / ") : "TAMAM"); process.exit(0);
})();
