/* Birden çok ekip ve ay: bir ekipte hazırlanan taslak başka ekibe / başka aya geçince düşmeli, asla yanlış yere yayınlanmamalı. */
const { openApp, fixture, SH, uid, DEPT } = require("../lib/harness");
const fails = [];
const ok = (c, m) => { console.log((c ? "✓ " : "✗ ") + m); if (!c) fails.push(m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const fx = fixture({ month: "2026-12", shifts: [SH("Gündüz", "08:00", "20:00", 2)], opts: {}, people: [{ name: "Yönetici Test", noDuty: true }, ...["A", "B", "C", "D", "E"].map(n => ({ name: "Kişi " + n }))] });
  const D2 = "22222222-2222-4222-8222-222222222222";
  fx.db.departments.push({ ...JSON.parse(JSON.stringify(fx.db.departments[0])), id: D2, name: "İkinci ekip", sched_mode: "rooms", shifts: [], general_rooms: 1, month: "2026-11" });
  fx.db.memberships.push(...[0, 6, 7, 8].map(k => ({ ...fx.db.memberships[0], user_id: k ? uid(k + 10) : fx.me, dept_id: D2, name: k ? "Oda Kişi " + k : "Yönetici Test", is_admin: !k, is_test: !!k, shift_prefs: k ? {} : { noDuty: true } })));
  const { w, E, db, errors } = await openApp(fx); w.__confirm = true;
  await E(`openTeam(${JSON.stringify(DEPT)})`); await sleep(200);
  ok(E("dept.name") === "Test" && E("myTeams.length") === 2, "iki ekipli yönetici ilk ekibi açtı");
  E("showTab('cizelge');generate();ALT.token++;ALT.busy=false");
  ok(!!E("draft") && E("$('decideCard').style.display") !== "none", "1. ekipte taslak hazır");
  await E(`openTeam(${JSON.stringify(D2)})`); await sleep(200);
  ok(E("dept.name") === "İkinci ekip", "2. ekibe geçildi");
  ok(!E("draft") && E("$('decideCard').style.display") === "none", "1. ekibin taslağı 2. ekipte görünmüyor");
  await E("confirmDecide()"); await sleep(200);
  ok(!db.schedules.some(s => s.dept_id === D2), "2. ekibe hiçbir şey yayınlanmadı");
  // 2. ekipte taslak → aynı ekipte ay değişirse taslak düşer
  E("showTab('cizelge');generate();ALT.token++;ALT.busy=false");
  ok(E("draft&&draft.mode") === "rooms", "2. ekipte kendi (oda) taslağı hazırlandı");
  await E("goToMonth('2026-12')"); await sleep(200);
  ok(!E("draft"), "hazırlanan ay değişince eski ayın taslağı düştü");
  // güvenlik ağı: taslak durumu bozulsa bile yayın başka aya yazmaz
  E("showTab('cizelge');generate();ALT.token++;ALT.busy=false");
  E("dept.month='2027-01'");
  await E("confirmDecide()"); await sleep(200);
  ok(!db.schedules.some(s => s.dept_id === D2 && s.month === "2027-01") && /başka bir ekip ya da ay/.test(E("$('toast').textContent")), "ayı tutmayan taslak yayınlanmadı, nedeni söylendi");
  E("dept.month='2026-12'");
  E("showTab('cizelge');generate();ALT.token++;ALT.busy=false");
  await E("confirmDecide()"); await sleep(300);
  ok(db.schedules.some(s => s.dept_id === D2 && s.month === "2026-12" && s.data.mode === "rooms"), "doğru ekip ve ayda yayın çalışıyor");
  ok(!db.schedules.some(s => s.dept_id === DEPT), "1. ekibe dokunulmadı");
  ok(!errors.length, "JS hatası yok" + (errors.length ? ": " + errors.slice(0, 2).join(" | ") : ""));
  console.log("SONUÇ:", fails.length ? fails.length + " hata: " + fails.join(" / ") : "TAMAM");
  process.exit(0);
})().catch(e => { console.error(e); console.log("SONUÇ: çöktü"); process.exit(1); });
