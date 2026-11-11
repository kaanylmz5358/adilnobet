/* Düşman senaryo üretici: tohumdan (seed) tekrar üretilebilir rastgele ekip + ayar + istek.
   Amaç: uygulamayı bozmak. Ekip büyüklüğü, vardiyalar, izinler, kesin/yok günler, kıdem, cinsiyet,
   kurallar, ritim, haftalık kurallar, sabit mesai, önceki ay kuyruğu, tatiller… hepsi rastgele ve birbirine karışık. */
const { fixture, SH, uid } = require("./harness");

const hm = t => { const [h, m] = String(t).split(":").map(Number); return h + (m || 0) / 60; };
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const SHIFT_LIB = [
  ["Gündüz", "08:00", "20:00"], ["Gece", "20:00", "08:00"], ["Sabah", "08:00", "16:00"], ["Akşam", "16:00", "24:00"],
  ["Gece", "00:00", "08:00"], ["Uzun", "08:00", "00:00"], ["24 saat", "08:00", "08:00"], ["Erken", "07:00", "15:00"],
  ["Geç", "15:00", "23:00"], ["Gece", "23:00", "07:00"], ["Ara", "10:00", "23:00"], ["Nöbet", "16:00", "08:00"], ["Kısa", "12:00", "18:00"],
];
const NAMES = ["Ayşe", "Mehmet", "Zeynep", "Ali", "Elif", "Can", "Deniz", "Ece", "Burak", "Selin", "Emre", "Fatma", "Gökhan", "Hale", "İpek", "Kerem",
  "Leyla", "Murat", "Nihan", "Onur", "Pelin", "Rıza", "Seda", "Tolga", "Ufuk", "Vildan", "Yasin", "Zehra", "Şule", "Çağrı"];
const MONTHS = ["2026-11", "2026-12", "2027-02", "2026-10", "2027-01"];

function scenario(seed, opt = {}) {
  const R = rng(seed), r = () => R(), ri = (a, b) => a + Math.floor(R() * (b - a + 1)), pick = a => a[Math.floor(R() * a.length)], ch = p => R() < p;
  const month = opt.month || pick(MONTHS);
  const [Y, M] = month.split("-").map(Number), nDays = new Date(Y, M, 0).getDate();
  const wd = d => (new Date(Y, M - 1, d).getDay() + 6) % 7;
  const mode = opt.mode || (ch(0.8) ? "shifts" : "rooms");
  // ekip: çoğunlukla 5–14, bazen 2–4 ya da 15–28
  const n = opt.n || (ch(0.12) ? ri(2, 4) : ch(0.15) ? ri(15, 28) : ri(5, 14));
  const meDuty = ch(0.5);                  // yönetici de nöbet tutuyor mu
  const people = [];
  for (let i = 0; i < n + (meDuty ? 0 : 1); i++) people.push({ name: NAMES[i % NAMES.length] + (i >= NAMES.length ? " " + (i + 1) : "") });
  if (!meDuty) people[0].noDuty = true;
  const P = people.length, duty = people.map((p, i) => i).filter(i => !people[i].noDuty);
  const tags = {};
  const o = { setup_done: true, people: {} };
  const dept = {};
  let shifts = [];
  const desc = [];
  if (mode === "shifts") {
    const k = ch(0.15) ? 1 : ch(0.5) ? 2 : ri(3, 4);
    const used = new Set();
    for (let j = 0; j < k; j++) {
      let t; do { t = pick(SHIFT_LIB); } while (used.has(t.join()) && used.size < SHIFT_LIB.length); used.add(t.join());
      const cnt = ch(0.55) ? 1 : ch(0.7) ? 2 : ri(3, 4);
      let days = [1, 1, 1, 1, 1, 1, 1];
      if (ch(0.15)) days = [1, 1, 1, 1, 1, 0, 0]; else if (ch(0.08)) days = [0, 0, 0, 0, 0, 1, 1];
      const extra = {};
      if (ch(0.05)) extra.icap = true;
      shifts.push(SH(t[0], t[1], t[2], cnt, days, { sid: "i" + j, ...extra }));
    }
    if (shifts.every(s => s.icap)) delete shifts[0].icap;
    // vardiyaya kimler: seçilenler hariç / yalnız seçilenler
    if (ch(0.15) && duty.length > 4) { const s = pick(shifts); s.deny = [uid(pick(duty) + 1)]; desc.push("deny"); }
    if (ch(0.08) && duty.length > 5) { const s = pick(shifts); s.only = duty.filter(() => ch(0.6)).map(i => uid(i + 1)); if (s.only.length < 2) delete s.only; else desc.push("only"); }
    o.min_rest_h = pick([0, 8, 8, 11, 12]);
    if (ch(0.4)) o.bal_dn = true; if (ch(0.3)) o.bal_we = true;
    o.partner_mode = pick(["rotate", "any", "rotate"]);
  } else {
    dept.general_rooms = ch(0.75) ? 1 : 2;
    dept.min_gap = pick([1, 2, 2, 3]);
    dept.work_model = pick(["shift_only", "duty_rest", "duty_work"]);
    if (ch(0.3)) { // haftalık kurallar (Perşembe/Cuma sonrası izin, gün sınırı, Ek Cumartesi)
      const off = [1, 1, 1, 1, 1, 1, 1].map(() => ch(0.2) ? ri(0, 3) : 1), max = [0, 0, 0, 0, 0, 0, 0].map(() => ch(0.25) ? ri(1, 2) : 0);
      o.wr = { on: true, off, max, track: max.map(x => x ? 1 : 0), sat: { on: ch(0.4), max: 1, need: ri(2, 3) }, fz: ch(0.5) };
      dept.work_model = "duty_rest"; desc.push("wr");
    }
  }
  // tatil
  if (ch(0.2)) { const a = ri(1, nDays - 3); dept.bayram = ch(0.5) ? `${a}-${a + ri(0, 3)}` : `${a}`; }
  // kişiler: hedef, gece, oran, sabit mesai, kısıt
  const totalSlots = mode === "shifts" ? shifts.reduce((t, s) => t + (s.icap ? 0 : (+s.count) * Array.from({ length: nDays }, (_, d) => s.days[wd(d + 1)]).filter(Boolean).length), 0) : nDays * dept.general_rooms;
  const share = totalSlots / Math.max(1, duty.length);
  const withTargets = ch(0.3), nightShift = shifts.findIndex(s => { const a = +s.start.slice(0, 2), b = +s.end.slice(0, 2); return a >= 18 || (b <= 9 && b > 0 && a > b) || a < 5; });
  duty.forEach(i => {
    const p = people[i];
    if (withTargets && ch(0.8)) { const t = Math.max(0, Math.round(share + (ch(0.5) ? ri(-3, 3) : 0))); if (mode === "shifts") p.target = t; else p.quota = t; }
    if (mode === "shifts" && nightShift >= 0 && ch(0.15)) p.night = ri(0, Math.max(0, Math.round(share / 2)));
    if (ch(0.06)) { p.sp = { ...(p.sp || {}), noNight: true }; }
    if (mode === "shifts" && ch(0.05)) p.sp = { ...(p.sp || {}), gap: ri(1, 2) };
  });
  if (ch(0.1) && duty.length > 3) {            // sabit mesai çalışanı
    const i = pick(duty); o.people[uid(i + 1)] = { ...(o.people[uid(i + 1)] || {}), ms: { on: true, d: [["08:00", "17:00"], ["08:00", "17:00"], ["08:00", "17:00"], ["08:00", "17:00"], ["08:00", "17:00"], ch(0.5) ? ["08:00", "13:00"] : null, null], hol: false } }; desc.push("mesai");
  }
  if (ch(0.1)) duty.forEach(i => { if (ch(0.15)) o.people[uid(i + 1)] = { ...(o.people[uid(i + 1)] || {}), ratio: pick([50, 60, 75, 80]) }; });
  // kıdem
  if (ch(0.35)) {
    duty.forEach(i => { o.people[uid(i + 1)] = { ...(o.people[uid(i + 1)] || {}), sv: ri(0, 5) }; });
    const th = ri(1, 4);
    if (mode === "shifts" && ch(0.5)) o.sen = { on: true, th, hiMin: 1, loMin: 0, scope: pick(["shift", "day", "time"]), mode: "guard" };
    else o.sen = { on: true, th, hiMin: ri(0, 2), loMin: ri(0, 1), scope: pick(["shift", "day"]) };
    desc.push("kıdem:" + (o.sen.mode || "komp") + "/" + o.sen.scope);
  }
  // cinsiyet
  if (ch(0.3)) {
    duty.forEach(i => { o.people[uid(i + 1)] = { ...(o.people[uid(i + 1)] || {}), g: ch(0.5) ? "k" : "e" }; });
    o.gen = { mode: pick(["mix", "spread"]), scope: pick(["shift", "day"]) }; desc.push("cins:" + o.gen.mode);
  }
  // etiket (yetkinlik)
  if (mode === "shifts" && ch(0.2)) { const T = pick(["YB", "Triyaj", "Çocuk"]); duty.forEach(i => { if (ch(0.4)) o.people[uid(i + 1)] = { ...(o.people[uid(i + 1)] || {}), tags: [T] }; }); tags.T = T; }
  // kurallar
  const rules = [];
  const nR = ch(0.35) ? 0 : ri(1, 4);
  for (let j = 0; j < nR; j++) {
    const hard = ch(0.4), id = "r" + j;
    const kind = mode === "shifts" ? pick(["limN", "after", "seq", "limH", "limD", "off", "we", "eq", "pair", "need", "only", "staff", "wkfull", "long", "cycle", "limS"]) : pick(["limD", "off", "we", "pair", "limDrow"]);
    const who = { k: "all" };
    const si = () => ri(0, shifts.length - 1);
    if (kind === "limN" && nightShift >= 0) rules.push({ id, t: "lim", who, op: "max", n: ri(1, 4), what: "night", per: pick(["row", "month", "week"]), hard });
    else if (kind === "after") rules.push({ id, t: "after", who, what: pick(["night", "night", "duty"]), n: ri(1, 2), ...(ch(0.2) ? { k: 2 } : {}), hard });
    else if (kind === "seq" && shifts.length > 1) { const a = si(); let b = si(); if (a === b) b = (a + 1) % shifts.length; rules.push({ id, t: "seq", who, fa: pick([String(a), "N"]), fb: pick([String(b), "D"]), hard }); }
    else if (kind === "limH") rules.push({ id, t: "lim", who, op: "max", n: pick([48, 60, 72]), what: "hours", per: pick(["week", "roll"]), win: 7, hard });
    else if (kind === "limD" || kind === "limDrow") rules.push({ id, t: "lim", who, op: "max", n: kind === "limDrow" ? ri(2, 5) : ri(Math.max(1, Math.floor(share) - 2), Math.ceil(share) + 3), what: "duty", per: kind === "limDrow" ? "row" : pick(["month", "roll"]), win: 7, hard });
    else if (kind === "off") rules.push({ id, t: "lim", who, op: "min", n: ri(1, 2), what: "off", per: pick(["week", "roll", "row"]), win: pick([7, 14]), hard });
    else if (kind === "we") rules.push({ id, t: "lim", who, op: "max", n: ri(1, 2), what: "weekend", per: pick(["row", "month", "roll"]), win: 3, hard });
    else if (kind === "eq") rules.push({ id, t: "eq", who, si: si() });
    else if (kind === "pair" && duty.length > 3) { const a = pick(duty); let b = pick(duty); if (a === b) b = duty[(duty.indexOf(a) + 1) % duty.length]; rules.push({ id, t: "pair", a: uid(a + 1), b: uid(b + 1), mode: ch(0.7) ? "never" : "same" }); }
    else if (kind === "need" && tags.T) rules.push({ id, t: "need", tag: tags.T, n: 1, scope: pick(["day", "shift"]), si: ch(0.5) ? -1 : si(), hard });
    else if (kind === "only" && tags.T) rules.push({ id, t: "only", tag: tags.T, si: si() });
    else if (kind === "staff") rules.push({ id, t: "staff", si: ch(0.5) ? -1 : si(), sel: pick(["wd", "bay"]), wd: [0, 0, 0, 0, 0, 1, 1], n: 1 });
    else if (kind === "wkfull") rules.push({ id, t: "wkfull", who, ...(ch(0.5) ? { mode: pick(["split", "type"]) } : {}) });
    else if (kind === "long") rules.push({ id, t: "lim", who, op: "max", n: ri(1, 3), what: "long", lh: 10, per: pick(["row", "roll"]), win: 7, hard });
    else if (kind === "limS") rules.push({ id, t: "lim", who, op: "max", n: ri(1, 2), what: "shift", si: si(), per: "week", hard });
    else if (kind === "cycle" && ch(0.3)) rules.push({ id, t: "cycle", who, pat: pick(["GGNN----", "GGNN---", "GG--"]) });
  }
  if (rules.length) { o.rules = rules; desc.push("kurallar:" + rules.map(x => x.t + (x.what ? "/" + x.what : "") + (x.hard ? "!" : "")).join(",")); }
  // ritim
  if (ch(0.15)) {
    if (ch(0.5) || mode === "rooms") { dept.pattern_on = pick([2, 3]); dept.pattern_off = pick([2, 3, 4]); desc.push(`ritim ${dept.pattern_on}+${dept.pattern_off}`); }
    else { const wMin = ri(1, 3), oMin = ri(1, 3); o.rhythm = { on: true, wMin, wMax: wMin + ri(0, 2), oMin, oMax: ch(0.5) ? oMin + ri(0, 3) : 0 }; desc.push("aralıklı ritim"); }
  }
  // engeller ve sabitlemeler
  const blocks = [];
  if (mode === "shifts" && ch(0.25)) duty.forEach(i => { if (ch(0.15)) blocks.push({ pid: uid(i + 1), type: "block", start: "00:00", end: "08:00", wdays: [1, 1, 1, 1, 1, 1, 1], days: "" }); if (ch(0.08)) blocks.push({ pid: uid(i + 1), type: "block", start: "", end: "", wdays: [0, 0, 0, 0, 0, 0, 1], days: "" }); });
  if (blocks.length) { o.blocks = blocks; desc.push("engel:" + blocks.length); }
  // istekler: izin, yok, kesin, istiyor, istemiyor, vardiyaya özel
  const prefs = {};
  const intense = ch(0.2);            // çok kısıtlı (düşman) ay
  duty.forEach(i => {
    const d0 = {};
    if (ch(intense ? 0.6 : 0.3)) { const a = ri(1, nDays); const L = ri(1, intense ? 12 : 7); for (let d = a; d < Math.min(nDays + 1, a + L); d++) d0[d] = "izin"; }
    const k1 = ch(0.5) ? ri(0, intense ? 6 : 3) : 0; for (let j = 0; j < k1; j++) d0[ri(1, nDays)] = "never";
    const k2 = ch(0.3) ? ri(0, intense ? 4 : 2) : 0; for (let j = 0; j < k2; j++) { const d = ri(1, nDays); if (!d0[d]) d0[d] = "must"; }
    const k3 = ch(0.4) ? ri(0, 5) : 0; for (let j = 0; j < k3; j++) { const d = ri(1, nDays); if (!d0[d]) d0[d] = ch(0.5) ? "yes" : "avoid"; }
    if (mode === "shifts" && ch(0.1)) { const sh = {}; const d = ri(1, nDays); if (!d0[d]) { sh[d] = { ["i" + ri(0, shifts.length - 1)]: pick(["must", "never", "yes", "avoid"]) }; d0._sh = sh; } }
    if (Object.keys(d0).length) prefs[i] = d0;
  });
  // önceki ay kuyruğu (son 7 gün)
  const schedules = [];
  if (ch(0.15)) {
    const pm = M === 1 ? `${Y - 1}-12` : `${Y}-${String(M - 1).padStart(2, "0")}`, pn = new Date(Y, M - 1, 0).getDate(), asg = {};
    for (let d = 1; d <= pn; d++) asg[d] = [];
    for (let d = pn - 6; d <= pn; d++) { const used = new Set(); if (mode === "shifts") shifts.forEach((s, si) => { if (s.icap) return; for (let c = 0; c < +s.count; c++) { const i = pick(duty); if (used.has(i)) continue; used.add(i); asg[d].push({ id: uid(i + 1), s: si }); } });
      else for (let c = 0; c < (dept.general_rooms || 1); c++) asg[d].push({ id: uid(pick(duty) + 1), r: "G" }); }
    schedules.push({ month: pm, data: { mode, asg } }); desc.push("kuyruk");
  }
  if (ch(0.1)) dept.fill_policy = "by_capacity";
  /* ---- ek boyutlar (ayrı rastgele akış: eski tohumların senaryoları değişmez) ----
     ücretsiz mola, zor nöbet puanı, vardiya süresi sınırı, hazır döngüler (ekip başlangıç tarihli), 8 saatlik üçlü döngü */
  if (!opt.noExtra) {
    const X = rng(seed * 7919 + 17), xc = p => X() < p, xp = a => a[Math.floor(X() * a.length)];
    const lp = xc(0.1);
    if (mode === "shifts") {
      shifts.forEach(s => { if (!s.icap && xc(0.2)) s.brk = xp([30, 45, 60]); });
      if (shifts.some(s => s.brk)) desc.push("mola");
      if (xc(0.15)) { o.pts = { on: true, n: xp([0.5, 1]), we: xp([0.5, 1]), bay: xp([1, 2]) }; shifts.forEach(s => { if (xc(0.3)) s.pts = xp([1.5, 2]); }); desc.push("puan"); }
      const RL = o.rules || [];
      if (xc(0.08)) RL.push({ id: "x0", t: "len", n: xp([7.5, 12, 13]), what: xp(["all", "night"]) });
      // NHS / INRC tipi ek kurallar: art arda k uzun vardiya sonrası izin, art arda aynı vardiya sınırı, ayda en az nöbet
      if (xc(0.06)) RL.push({ id: "x2", t: "after", who: { k: "all" }, what: "long", lh: 10, n: 2, k: xp([3, 4]), hard: xc(0.5) });
      if (xc(0.06)) RL.push({ id: "x3", t: "lim", who: { k: "all" }, op: "max", n: xp([2, 3]), what: "shift", si: Math.floor(X() * shifts.length), per: "row", hard: xc(0.4) });
      if (xc(0.05)) RL.push({ id: "x4", t: "lim", who: { k: "all" }, op: "min", n: xp([2, 3, 4]), what: "duty", per: "month", hard: false });
      if (xc(0.04)) RL.push({ id: "x5", t: "lim", who: { k: "all" }, op: "max", n: 1, what: "weekend", per: "roll", win: 3, hard: xc(0.5) });
      if (!RL.some(r => r.t === "cycle") && xc(0.12)) {
        const real = shifts.map((s, i) => ({ s, i })).filter(z => !z.s.icap).sort((a, b) => hm(a.s.start) - hm(b.s.start));
        let pat = xp(["GGNN----", "GN--", "GGNN--", "GGGG----NNNN----", "GG--GGG--GG---", "NNNN---GGG-NNN---GGGG-------", "GGGG----", "GGGGG--", "GGGG---"]);
        if (real.length >= 3 && xc(0.4)) { const [a1, b1, c1] = real.slice(0, 3).map(z => String(z.i + 1)); pat = a1 + a1 + b1 + b1 + c1 + c1 + "--"; }
        if (xc(0.5) && duty.length >= 2) {   // A/B/C/D ekip döngüsü: her ekip aynı gün başlar, ekipler kaydırmalı
          const k = Math.min(duty.length, xp([2, 3, 4])), step = Math.max(1, Math.round(pat.length / k)), base = Date.UTC(2026, xp([8, 9, 10]), xp([1, 3, 15]));
          const sh = duty.slice().sort(() => X() - 0.5);
          for (let t = 0; t < k; t++) { const ids = sh.filter((_, j) => j % k === t).map(i => uid(i + 1)); if (!ids.length) continue;
            RL.push({ id: "xc" + t, t: "cycle", who: { k: "p", ids }, pat, start: new Date(base + t * step * 864e5).toISOString().slice(0, 10) }); }
          desc.push(`ekip döngüsü ${pat} ×${k}`);
        } else { RL.push({ id: "x1", t: "cycle", who: { k: "all" }, pat }); desc.push("döngü " + pat); }
      }
      if (RL.length) o.rules = RL;
    }
    if (lp) { o.leave_prop = true; desc.push("izne oranlı"); }
    if (((o.wr && o.wr.on && o.wr.fz) || o.leave_prop) && xc(0.5)) { o.quota_month = month; desc.push("sayılar bu ay"); }
    // oda modu: branşa özel odalar (yalnız o branş; "devredilir"se boşken genele açılır) — branş üyeleri genel odaya girmez
    if (mode !== "shifts" && xc(0.25) && duty.length >= 4) {
      const B = xp(["Anestezi", "Kadın Doğum"]), k = Math.max(2, Math.round(duty.length * xp([0.25, 0.4])));
      duty.slice().sort(() => X() - 0.5).slice(0, k).forEach(i => { people[i].pool = B; });
      dept.branch_rooms = { [B]: { rooms: 1, shared: xc(0.5) } };
      if (xc(0.4)) duty.filter(i => people[i].pool === B).forEach(i => { people[i].quota = Math.round(nDays / k); });
      desc.push(`branş odası ${B}${dept.branch_rooms[B].shared ? " (devredilir)" : ""}`);
    }
    if (mode !== "shifts" && xc(0.1)) {
      const RL = o.rules || []; const r = { id: "x1", t: "cycle", who: { k: "all" }, pat: xp(["*--", "*---", "*-*-*----"]) };
      if (xc(0.5)) r.start = xp(["2026-09-01", "2026-11-03"]); RL.push(r); o.rules = RL; desc.push("döngü " + r.pat + (r.start ? " (ekip)" : ""));
    }
  }
  const fx = fixture({ month, mode, shifts, opts: o, people, prefs, dept, schedules });
  fx.meta = { seed, mode, n: duty.length, month, slots: totalSlots, desc: desc.join(" · "), intense };
  return fx;
}
module.exports = { scenario, rng };
