/* Uygulama arka plandan dönünce: veriler eskiyse tazelenir (yayınlanan liste üyede görünür); taslak açıkken dokunulmaz. */
const { openApp, fixture, SH, uid } = require("../lib/harness");
const fails = [];
const ok = (c, m) => { console.log((c ? "✓ " : "✗ ") + m); if (!c) fails.push(m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const fx = fixture({ month: "2026-12", shifts: [SH("Gündüz", "08:00", "20:00", 2)], opts: {}, people: [{ name: "Yönetici Test", noDuty: true }, ...["A", "B", "C", "D"].map(n => ({ name: "Kişi " + n }))], meIdx: 1 });
  const { w, E, db, errors } = await openApp(fx);   // üye olarak açık
  ok(!E("schedule"), "üyede henüz liste yok");
  // bu arada yönetici yayınladı (başka cihaz)
  const asg = {}; for (let d = 1; d <= 31; d++) asg[d] = [{ id: uid(2 + (d % 4)), s: 0 }, { id: uid(2 + ((d + 1) % 4)), s: 0 }];
  db.schedules.push({ dept_id: db.departments[0].id, month: "2026-12", data: { mode: "shifts", asg, cnt: {}, viol: [] } });
  const vis = h => { w.eval(`Object.defineProperty(document,'hidden',{value:${h},configurable:true});document.dispatchEvent(new Event('visibilitychange'))`); };
  vis(true); vis(false); await sleep(300);
  ok(!E("schedule"), "kısa süre sonra dönünce gereksiz yükleme yok");
  E("LAST_LOAD=Date.now()-6*60e3"); vis(true); vis(false); await sleep(500);
  ok(!!E("schedule") && E("Object.keys(schedule.asg).length") === 31, "5 dakikadan sonra dönünce yayınlanan liste göründü");
  // açık perde varken tazeleme yapılmaz
  E("LAST_LOAD=Date.now()-6*60e3"); E("openPerson(members[1].id)"); const t0 = E("LAST_LOAD"); vis(true); vis(false); await sleep(300);
  ok(E("LAST_LOAD") === t0 && E("$('personSheet').classList.contains('on')"), "açık pencere varken tazelenmedi, pencere kapanmadı");
  ok(!errors.length, "JS hatası yok" + (errors.length ? ": " + errors.slice(0, 2).join(" | ") : ""));
  console.log("SONUÇ:", fails.length ? fails.length + " hata: " + fails.join(" / ") : "TAMAM");
  process.exit(0);
})().catch(e => { console.error(e); console.log("SONUÇ: çöktü"); process.exit(1); });
