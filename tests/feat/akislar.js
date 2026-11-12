/* Uçtan uca akışlar: taslak → yayın → günü düzenle → takas (uygun / kurala takılan) → izin onayı → ayı kapat.
   Her adımda veritabanına yazılan liste bağımsız denetçiyle kontrol edilir. */
const { openApp, fixture, SH, uid } = require("../lib/harness");
const { check } = require("../lib/checker");
const fails = [];
const ok = (c, m) => { console.log((c ? "✓ " : "✗ ") + m); if (!c) fails.push(m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const iz = (a, b, v = "izin") => { const o = {}; for (let d = a; d <= b; d++) o[d] = v; return o; };
(async () => {
  const people = [{ name: "Yönetici Test", noDuty: true }, ...["Ada", "Bora", "Cem", "Duru", "Efe", "Feza", "Gaye", "Hakan"].map(name => ({ name }))];
  const fx = fixture({ month: "2026-12", shifts: [SH("Gündüz", "08:00", "20:00", 1, undefined, { sid: "g" }), SH("Gece", "20:00", "08:00", 1, undefined, { sid: "n" })],
    opts: { min_rest_h: 11, rules: [{ id: "a", t: "after", who: { k: "all" }, what: "night", n: 1, hard: true }] }, people, prefs: { 3: iz(10, 12), 5: { 20: "izin_bek", 21: "izin_bek" } } });
  const M = "2026-12";
  let st = fx, D = null;
  const open = async () => { const r = await openApp(st); st = { me: fx.me, db: r.db }; D = r.db; r.w.__confirm = true; return r; };
  let { w, E, errors } = await open();
  w.__confirm = true;
  // A) taslak ve yayın
  E("showTab('cizelge');generate();ALT.token++;ALT.busy=false");
  const dr = E("draft");
  ok(!!dr && dr.emptyCount === 0, "taslak hazırlandı, boş yer yok");
  await E("confirmDecide()"); await sleep(400);
  const pub = () => (st.db.schedules.find(s => s.month === M) || {}).data;
  ok(!!pub() && JSON.stringify(pub().asg) === JSON.stringify(dr.asg), "yayınlanan liste taslağın aynısı");
  const c0 = check(st, pub(), {});
  ok(!c0.problems.length, "yayınlanan liste denetçiden temiz: " + (c0.problems.slice(0, 2).join(" | ") || "—"));
  // B) günü düzenle: izinli kişiyi bilerek yaz → kaydeder ama uyarır
  ({ w, E, errors } = await open());
  await E(`(async()=>{showTab('cizelge');await setViewMonth('${M}');})()`); await sleep(200);
  E("openDayEdit(11,'pub')"); await sleep(100);
  const cemId = uid(4);   // izinli (10–12)
  E(`(()=>{const s=document.querySelector('.deSel[data-i="0"]');s.value='${cemId}';})()`);
  await E("saveDayEdit()"); await sleep(300);
  const t1 = E("document.getElementById('toast').textContent");
  ok(pub().asg[11].some(e => e.id === cemId), "yönetici izinli kişiyi bilerek yazabildi (kaydedildi)");
  ok(/izin/i.test(t1), "kaydederken izinli olduğu söylendi: " + t1.replace(/\s+/g, " ").slice(0, 120));
  // aynı kişi iki yere
  E("openDayEdit(14,'pub')"); await sleep(100);
  const before14 = JSON.stringify(pub().asg[14]);
  E(`(()=>{const a=document.querySelector('.deSel[data-i="0"]'),b=document.querySelector('.deSel[data-i="1"]');b.value=a.value;})()`);
  await E("saveDayEdit()"); await sleep(200);
  ok(/iki kez/.test(E("document.getElementById('toast').textContent")) && JSON.stringify(pub().asg[14]) === before14, "aynı kişiyi aynı güne iki kez yazmak engellendi");
  E("closeDayEdit()");
  // C) takas: uygun kişiyle → uygulanır
  const asg = pub().asg, works = (id, d) => (asg[d] || []).some(e => e.id === id);
  let swapOk = null, swapBad = null;
  // önce uygun takas, sonra ondan ve düzenlenen 11. günden uzak bir günde kurala takılan takas (dün gece çalışan → bugün gündüz olmaz)
  for (let d = 3; d <= 27 && !swapOk; d++) if (d !== 11) for (const e of asg[d] || []) for (let k = 2; k <= 9 && !swapOk; k++) {
    const b = uid(k); if (b === e.id) continue;
    const free = !works(b, d - 1) && !works(b, d) && !works(b, d + 1) && !works(b, d - 2) && !(D.prefs.find(p => p.user_id === b && p.month === M && (p.days || {})[d]));
    if (free && e.s === 0) swapOk = { d, a: e.id, b }; }
  for (let d = 3; d <= 27 && !swapBad; d++) if (Math.abs(d - 11) > 1 && Math.abs(d - swapOk.d) > 2) for (const e of asg[d] || []) for (let k = 2; k <= 9 && !swapBad; k++) {
    const b = uid(k); if (b === e.id || e.s !== 0) continue;
    if ((asg[d - 1] || []).some(x => x.id === b && x.s === 1)) swapBad = { d, a: e.id, b }; }
  D.swap_requests.push({ id: 1, dept_id: D.departments[0].id, month: M, day: swapOk.d, out_id: swapOk.a, in_id: swapOk.b, note: "", status: "bekliyor", reason: "" });
  if (swapBad) D.swap_requests.push({ id: 2, dept_id: D.departments[0].id, month: M, day: swapBad.d, out_id: swapBad.a, in_id: swapBad.b, note: "", status: "bekliyor", reason: "" });
  ({ w, E, errors } = await open());
  await E(`(async()=>{await setViewMonth('${M}');showTab('takas');})()`); await sleep(200);
  await E("acceptReq(1)"); await sleep(300);
  ok(pub().asg[swapOk.d].some(e => e.id === swapOk.b) && !pub().asg[swapOk.d].some(e => e.id === swapOk.a), `uygun takas uygulandı (${swapOk.d}. gün)`);
  ok(st.db.swap_requests.find(r => r.id === 1).status === "kabul", "takas isteği 'kabul' oldu");
  if (swapBad) {
    const snap = JSON.stringify(pub().asg);
    await E("acceptReq(2)"); await sleep(300);
    const r2 = st.db.swap_requests.find(r => r.id === 2);
    ok(r2.status === "red" && /uç uca|çakış/.test(r2.reason) && !/bulunamadı/.test(r2.reason) && JSON.stringify(pub().asg) === snap, "gece çıkışına gündüz takası reddedildi, liste değişmedi: " + r2.reason.slice(0, 80));
  } else ok(true, "(kurala takılan takas örneği bulunamadı, atlandı)");
  const c1 = check(st, pub(), {}); const c1b = c1.problems.filter(t => !/Cem 11\. gün izinli/.test(t));
  ok(!c1b.length, "takaslardan sonra liste denetçiden temiz (bilerek yazılan izinli gün hariç): " + (c1b.slice(0, 2).join(" | ") || "—"));
  // D) izin onayı
  await E("decideLeave(" + JSON.stringify(uid(6)) + ",true,{noConfirm:true})"); await sleep(200);
  const p5 = st.db.prefs.find(p => p.user_id === uid(6) && p.month === M) || {};
  ok((p5.days || {})[20] === "izin" && (p5.days || {})[21] === "izin", "bekleyen izin onaylandı (izin_bek → izin)");
  // E) ayı kapat → sonraki ay açılır, yayınlanan liste aynen kalır
  const snapPub = JSON.stringify(pub());
  E("showTab('ayarlar');setPage('kapat')"); await sleep(100);
  await E("closeMonthGo()"); await sleep(400);
  ok(st.db.departments[0].month === "2027-01", "ay kapatıldı, Ocak 2027 açıldı");
  ok(JSON.stringify(pub()) === snapPub, "kapanan ayın listesi aynen duruyor");
  ok(!errors.length, "JS hatası yok" + (errors.length ? ": " + errors.slice(0, 2).join(" | ") : ""));
  console.log("SONUÇ:", fails.length ? fails.length + " hata: " + fails.join(" / ") : "TAMAM");
  process.exit(0);
})().catch(e => { console.error(e); console.log("SONUÇ: çöktü"); process.exit(1); });
