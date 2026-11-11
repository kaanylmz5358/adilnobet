/* Arayüz testleri için zengin sahte ekipler: yayınlanmış listeler, istekler, izin talepleri, takas.
   (Gerçek kişi verisi yok.) node ui/make_fixtures.js → ui/fx_shift.json, ui/fx_room.json */
const fs = require("fs"), path = require("path");
const { openApp, fixture, SH, uid } = require("../lib/harness");
const iz = (a, b, v = "izin") => { const o = {}; for (let d = a; d <= b; d++) o[d] = v; return o; };
const NAMES = ["Ayşe Kaya", "Mehmet Demir", "Zeynep Çelik", "Ali Yıldız", "Elif Şahin", "Can Öztürk", "Deniz Aydın", "Ece Arslan", "Burak Doğan", "Selin Kılıç", "Emre Aslan", "Fatma Koç"];
async function build(fx, file, extra) {
  const { w, E, db, errors } = await openApp(fx);
  E("showTab('cizelge');generate()");
  for (let i = 0; i < 400; i++) { await new Promise(r => setTimeout(r, 250)); if (!E("ALT.busy")) break; }
  if (E("ALT.list.length")) E("altApply(0)");
  w.__confirm = true; await E("confirmDecide()"); await new Promise(r => setTimeout(r, 500));
  if (extra) extra(db);
  fs.writeFileSync(path.join(__dirname, file), JSON.stringify({ me: fx.me, db }));
  console.log(file, "listeler:", db.schedules.map(s => s.month), "JS:", errors.slice(0, 2));
}
(async () => {
  // vardiyalı ekip: 12 kişi, gündüz/gece/uzun, kıdem, cinsiyet, kurallar, istekler, izinler
  const people = NAMES.map((name, i) => ({ name }));
  people.unshift({ name: "Yönetici Test", noDuty: true });
  const P = {}; NAMES.forEach((_, i) => { P[uid(i + 2)] = { sv: i % 5, g: i % 2 ? "k" : "e" }; });
  const fxS = fixture({ month: "2026-12", shifts: [SH("Gündüz", "08:00", "20:00", 2, undefined, { sid: "i0" }), SH("Gece", "20:00", "08:00", 2, undefined, { sid: "i1" }), SH("Uzun", "08:00", "00:00", 1, undefined, { sid: "i2" })],
    opts: { min_rest_h: 11, bal_dn: true, people: P, sen: { on: true, th: 2, hiMin: 1, loMin: 0, scope: "time", mode: "guard" }, gen: { mode: "spread" },
      rules: [{ id: "a", t: "after", who: { k: "all" }, what: "night", n: 2, hard: true }, { id: "b", t: "lim", who: { k: "all" }, op: "max", n: 2, what: "night", per: "row", hard: true }, { id: "c", t: "eq", who: { k: "all" }, si: 2 }] },
    people, prefs: { 1: iz(3, 9), 2: { 12: "never", 13: "never", 24: "must" }, 4: { 1: "yes", 2: "yes", 20: "avoid" }, 6: iz(20, 31), 8: { 5: "must", 6: "never" } },
    schedules: [] });
  await build(fxS, "fx_shift.json", db => {
    db.prefs.push({ user_id: uid(3), dept_id: db.departments[0].id, month: "2027-01", days: { 2: "yes", 3: "izin?" } });
    // önceki ay da yayınlanmış olsun (ay kaydırma, çok aylı görünüm, devir)
    const s0 = db.schedules.find(x => x.month === "2026-12");
    if (s0) { const s1 = JSON.parse(JSON.stringify(s0)); s1.month = "2026-11"; if (s1.data && s1.data.asg) delete s1.data.asg[31]; db.schedules.unshift(s1); }
  });
  // aynı ekip, ama giren kişi sıradan üye (yönetici değil): yetkisiz düğmeler, salt okunur ayarlar, istek / takas akışları
  { const F = JSON.parse(fs.readFileSync(path.join(__dirname, "fx_shift.json"), "utf8")); F.me = uid(3); fs.writeFileSync(path.join(__dirname, "fx_uye.json"), JSON.stringify(F)); console.log("fx_uye.json (üye: " + uid(3).slice(-2) + ")"); }
  // her şey açık ekip: icap, sabit mesai, ekip döngüsü, engeller, sabitlemeler, yetkinlik kuralları, mola, puan, kıdem/cinsiyet
  { const N2 = NAMES.slice(0, 10), pz = [{ name: "Yönetici Test", noDuty: true }, ...N2.map(name => ({ name }))];
    const PP = {}; N2.forEach((_, i) => { PP[uid(i + 2)] = { sv: i % 4, g: i % 2 ? "k" : "e", ...(i < 4 ? { tags: ["YB"] } : {}) }; });
    PP[uid(11)] = { ...PP[uid(11)], ms: { on: true, d: [["08:00", "17:00"], ["08:00", "17:00"], ["08:00", "17:00"], ["08:00", "17:00"], ["08:00", "17:00"], null, null] } };
    const fxZ = fixture({ month: "2026-12", shifts: [SH("Gündüz", "08:00", "20:00", 2, undefined, { sid: "g", brk: 60 }), SH("Gece", "20:00", "08:00", 2, undefined, { sid: "n", pts: 2 }), SH("İcap", "08:00", "08:00", 1, undefined, { sid: "ic", icap: true })],
      dept: { bayram: "25" },
      opts: { min_rest_h: 11, people: PP, pts: { on: true, n: 1, we: 1, bay: 2 }, sen: { on: true, th: 2, hiMin: 1, loMin: 0, scope: "shift", mode: "guard" }, gen: { mode: "spread" },
        blocks: [{ pid: uid(3), type: "block", start: "00:00", end: "08:00", wdays: [1, 1, 1, 1, 1, 1, 1], days: "" }], pins: [{ pid: uid(4), days: "10", si: "" }],
        rules: [{ id: "c0", t: "cycle", who: { k: "p", ids: [uid(5), uid(6)] }, pat: "GGNN----", start: "2026-11-01" }, { id: "nd", t: "need", tag: "YB", n: 1, scope: "day", si: -1 },
          { id: "h", t: "lim", who: { k: "all" }, op: "max", n: 72, what: "hours", per: "roll", win: 7, hard: true }, { id: "w", t: "lim", who: { k: "all" }, op: "max", n: 1, what: "weekend", per: "roll", win: 2 },
          { id: "s", t: "seq", who: { k: "all" }, fa: "N", fb: "D", hard: true }, { id: "len", t: "len", n: 13, what: "all" }],
        leave_cap: 2, req_lim: { izin: 5, never: 4 }, open_mode: "approve" },
      people: pz, prefs: { 2: iz(14, 18), 3: { 5: "must", 6: "never", _sh: { 12: { n: "yes" } } }, 7: { 20: "izin_bek", 21: "izin_bek" } }, schedules: [] });
    await build(fxZ, "fx_zengin.json"); }
  // oda (24 saat) ekip: Perşembe/Cuma sonrası izin, Ek Cumartesi, 6 kişi
  const pr = [{ name: "Yönetici Test" }, ...NAMES.slice(0, 6).map(name => ({ name }))];
  const fxR = fixture({ month: "2026-12", mode: "rooms", dept: { general_rooms: 1, min_gap: 2, work_model: "duty_rest" },
    opts: { wr: { on: true, off: [1, 1, 1, 3, 3, 1, 1], max: [0, 0, 0, 1, 1, 0, 0], track: [0, 0, 0, 1, 1, 0, 0], sat: { on: true, max: 1, need: 3 }, fz: true }, leave_prop: true },
    people: pr, prefs: { 1: iz(14, 18), 3: { 10: "yes", 11: "never" } } });
  await build(fxR, "fx_room.json");
  process.exit(0);
})();
