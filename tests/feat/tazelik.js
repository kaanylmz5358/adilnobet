/* Uygulama açıkken üyenin girdiği izin: yönetici "taslak üret" deyince veritabanından tazelenip dikkate alınmalı. */
const { openApp, fixture, SH, uid } = require("../lib/harness");
const fails = [];
const ok = (c, m) => { console.log((c ? "✓ " : "✗ ") + m); if (!c) fails.push(m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const fx = fixture({ month: "2026-12", shifts: [SH("Gündüz", "08:00", "20:00", 2)], opts: {}, people: [{ name: "Yönetici Test", noDuty: true }, ...["A", "B", "C", "D", "E"].map(n => ({ name: "Kişi " + n }))] });
  const { w, E, db, errors } = await openApp(fx);
  // yönetici uygulamayı açtıktan SONRA üye 10–16 arası izin giriyor (başka cihazdan)
  const o = {}; for (let d = 10; d <= 16; d++) o[d] = "izin";
  db.prefs.push({ user_id: uid(2), dept_id: db.departments[0].id, month: "2026-12", days: o });
  ok(!E(`allPrefs[${JSON.stringify(uid(2))}]`), "yöneticinin ekranında izin henüz yok (eski veri)");
  E("showTab('cizelge')"); await E("generateFresh()"); await sleep(100); E("ALT.token++;ALT.busy=false");
  const asg = E("draft.asg"); let bad = 0; for (let d = 10; d <= 16; d++) if ((asg[d] || []).some(e => e.id === uid(2))) bad++;
  ok(bad === 0, "taslak üye izinli günlerde ona nöbet yazmadı (veriler tazelendi)");
  // yöneticinin kaydedilmemiş boyaması kaybolmamalı: önce kaydedilir, sonra tazelenir
  E("showTab('izin')"); E(`(()=>{const s=document.getElementById('asPerson');if(s){s.value=${JSON.stringify(uid(3))};s.dispatchEvent(new Event('change'))}})()`);
  E("setBrush('izin')"); E("paintPref(20)"); E("paintPref(21)"); E("prefPainted()");
  await sleep(400);   // art arda basmaya karşı kısa bekleme süresi
  E("showTab('cizelge')"); await E("generateFresh()"); await sleep(100); E("ALT.token++;ALT.busy=false");
  const a2 = E("draft.asg");
  ok(![20, 21].some(d => (a2[d] || []).some(e => e.id === uid(3))) && ((db.prefs.find(p => p.user_id === uid(3) && p.month === "2026-12") || {}).days || {})[20] === "izin", "yöneticinin az önce girdiği izin kaydedildi ve kaybolmadı");
  // art arda iki basış: ikincisi yok sayılır (taslak bir kez hazırlanır)
  await sleep(400); E("window.__gc=0;const __g=generate;window.generate=function(){__gc++;return __g.apply(this,arguments)}");
  await Promise.all([E("generateFresh()"), E("generateFresh()")]); await sleep(500);
  ok(E("__gc") === 1, "art arda iki basışta taslak bir kez hazırlandı (" + E("__gc") + ")");
  ok(!errors.length, "JS hatası yok" + (errors.length ? ": " + errors.slice(0, 2).join(" | ") : ""));
  console.log("SONUÇ:", fails.length ? fails.length + " hata: " + fails.join(" / ") : "TAMAM");
  process.exit(0);
})().catch(e => { console.error(e); console.log("SONUÇ: çöktü"); process.exit(1); });
