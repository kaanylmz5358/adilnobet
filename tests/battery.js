/* Absürt senaryo bataryası: elle kurulmuş ~60 uç durum → taslak → bağımsız denetçi → sessiz hata avı → öneriler.
   node battery.js [senaryo …]   (boş: hepsi) · sonuç: out/battery_out.json · hata varsa çıkış kodu 1 */
const { openApp, fixture, SH, uid } = require("./lib/harness");
const { check } = require("./lib/checker");
const iz = (a, b, v = "izin") => { const o = {}; for (let d = a; d <= b; d++) o[d] = v; return o; };
const P = (k, extra = {}) => Array.from({ length: k }, (_, i) => ({ name: "Kişi" + String.fromCharCode(65 + i), ...extra }));
const D7 = [1, 1, 1, 1, 1, 1, 1];

const SC = {
  sek_3vardiya: () => fixture({ shifts: [SH("V", "08:00", "23:00"), SH("V", "08:00", "20:00"), SH("V", "07:00", "20:00", 1, [1, 1, 1, 1, 1, 1, 0])],
    opts: { sen: { on: true }, rhythm: { on: true, wMin: 2, wMax: 2, oMin: 2, oMax: 3 }, leave_prop: true, min_rest_h: 8, quota_month: "2026-11", partner_mode: "rotate", bal_dn: true },
    people: [{ name: "Ada", noDuty: true }, ...P(6)], prefs: { 3: iz(1, 8), 0: { 19: "must", 14: "never" } } }),
  sek_noleave: () => fixture({ shifts: [SH("V", "08:00", "23:00"), SH("V", "08:00", "20:00"), SH("V", "07:00", "20:00", 1, [1, 1, 1, 1, 1, 1, 0])],
    opts: { rhythm: { on: true, wMin: 2, wMax: 2, oMin: 2, oMax: 3 }, leave_prop: true, min_rest_h: 8, quota_month: "2026-11", partner_mode: "rotate" },
    people: [{ name: "Ada", noDuty: true }, ...P(6)] }),
  ritim_sayilar: () => fixture({ month: "2026-12", dept: { pattern_on: 2, pattern_off: 2 },
    shifts: [SH("V", "08:00", "23:00", 1, [1, 1, 1, 1, 1, 1, 0]), SH("V", "07:00", "20:00", 1, [1, 1, 1, 1, 1, 1, 0]), SH("V", "08:00", "20:00", 1, [1, 1, 1, 1, 1, 1, 0]), SH("V", "08:00", "20:00", 1, [0, 0, 0, 0, 0, 0, 1]), SH("V", "08:00", "23:00", 1, [0, 0, 0, 0, 0, 0, 1])],
    opts: { bal_dn: true, bal_we: true, min_rest_h: 8, partner_mode: "rotate" },
    people: [{ name: "Bora", target: 15, night: 0 }, { name: "Cem", target: 15, night: 0 }, { name: "Duru", target: 15, night: 0 }, { name: "Efe", target: 15, night: 0 }, { name: "Ada", target: 15, night: 0 }, { name: "Feza", target: 14, night: 0 }], meIdx: 2 }),
  ritim_serbest: () => fixture({ month: "2026-12", dept: { pattern_on: 2, pattern_off: 2 },
    shifts: [SH("V", "08:00", "23:00", 1, [1, 1, 1, 1, 1, 1, 0]), SH("V", "07:00", "20:00", 1, [1, 1, 1, 1, 1, 1, 0]), SH("V", "08:00", "20:00", 1, [1, 1, 1, 1, 1, 1, 0]), SH("V", "08:00", "20:00", 1, [0, 0, 0, 0, 0, 0, 1]), SH("V", "08:00", "23:00", 1, [0, 0, 0, 0, 0, 0, 1])],
    opts: { min_rest_h: 8, partner_mode: "rotate" }, people: P(6) }),
  acil_benzeri: () => fixture({ shifts: [SH("Gündüz", "08:00", "20:00", 2, D7, { mesai: true }), SH("Gece", "20:00", "08:00", 2, D7, { mesai: true })],
    opts: { leave_prop: true, quota_month: "2026-11", min_rest_h: 8 },
    people: [{ name: "Gaye", target: 16, night: 8 }, { name: "Hakan", target: 15, night: 8 }, { name: "Bora", target: 15, night: 8 }, { name: "Ada", target: 15, night: 7 }, { name: "Işıl", target: 12, night: 5 }, { name: "Jale", target: 16, night: 8 }, { name: "Kuzey", target: 15, night: 8 }, { name: "Lale", target: 16, night: 8 }], meIdx: 3 }),
  acil_rhythm: () => fixture({ shifts: [SH("Gündüz", "08:00", "20:00", 2), SH("Gece", "20:00", "08:00", 2)],
    opts: { rhythm: { on: true, wMin: 2, wMax: 3, oMin: 2, oMax: 3 }, min_rest_h: 8 }, people: P(8), prefs: { 1: iz(10, 13), 4: { 20: "must" } } }),
  icu_sen: () => fixture({ shifts: [SH("Gündüz", "08:00", "20:00", 2), SH("Gece", "20:00", "08:00", 2)],
    opts: { sen: { on: true, th: 3, hiMin: 1, loMin: 1, scope: "shift" }, people: Object.fromEntries(Array.from({ length: 11 }, (_, i) => [uid(i + 1), { sv: i < 5 ? 5 : 1, g: i % 2 ? "k" : "e" }])), min_rest_h: 8, rhythm: { on: true, wMin: 2, wMax: 2, oMin: 2, oMax: 3 } },
    people: P(11) }),
  icu_sen_impossible: () => fixture({ shifts: [SH("Gündüz", "08:00", "20:00", 1), SH("Gece", "20:00", "08:00", 1)],
    opts: { sen: { on: true, th: 3, hiMin: 1, loMin: 1, scope: "shift" }, people: Object.fromEntries(Array.from({ length: 6 }, (_, i) => [uid(i + 1), { sv: i < 3 ? 5 : 1 }])), min_rest_h: 8 },
    people: P(6) }),
  all_leave_day15: () => fixture({ shifts: [SH("V", "08:00", "20:00", 2)], opts: { min_rest_h: 8 }, people: P(5), prefs: Object.fromEntries([0, 1, 2, 3, 4].map(i => [i, { 15: "izin" }])) }),
  one_person_3shifts: () => fixture({ shifts: [SH("A", "08:00", "16:00"), SH("B", "16:00", "24:00"), SH("C", "00:00", "08:00")], opts: { min_rest_h: 8 }, people: P(1) }),
  targets_over: () => fixture({ shifts: [SH("V", "08:00", "20:00")], opts: { min_rest_h: 8 }, people: P(6, { target: 25 }) }),
  targets_under: () => fixture({ shifts: [SH("V", "08:00", "20:00", 2)], opts: { min_rest_h: 8 }, people: P(4, { target: 5 }) }),
  nights_over: () => fixture({ shifts: [SH("G", "08:00", "20:00"), SH("N", "20:00", "08:00")], opts: { min_rest_h: 8 }, people: P(4, { target: 15, night: 12 }) }),
  must_on_noshift_day: () => fixture({ shifts: [SH("V", "08:00", "20:00", 1, [1, 1, 1, 1, 1, 0, 0])], opts: {}, people: P(3), prefs: { 1: { 1: "must", 7: "must" } } }),
  pin_on_leave: () => fixture({ shifts: [SH("V", "08:00", "20:00")], opts: { pins: [{ pid: uid(2), days: "5", si: "" }] }, people: P(4), prefs: { 1: iz(3, 7) } }),
  double_must_one_slot: () => fixture({ shifts: [SH("V", "08:00", "20:00")], opts: {}, people: P(4), prefs: { 0: { 10: "must" }, 1: { 10: "must" }, 2: { 10: "must" } } }),
  rest24_two_people: () => fixture({ shifts: [SH("A", "08:00", "20:00"), SH("B", "20:00", "08:00")], opts: { min_rest_h: 24 }, people: P(2) }),
  feb_rhythm_prev: () => fixture({ month: "2027-02", shifts: [SH("V", "08:00", "20:00", 2)], opts: { rhythm: { on: true, wMin: 2, wMax: 2, oMin: 2, oMax: 2 }, min_rest_h: 8 }, people: P(4),
    schedules: [{ month: "2027-01", data: { mode: "shifts", asg: Object.fromEntries(Array.from({ length: 31 }, (_, k) => { const d = k + 1; const ph = [0, 0, 1, 1]; const w = [0, 1, 2, 3].filter(i => ((d - 1 + [0, 2, 1, 3][i]) % 4) < 2); return [d, w.slice(0, 2).map(i => ({ id: uid(i + 1), s: 0 }))]; })) } }] }),
  long_blocks: () => fixture({ shifts: [SH("G", "08:00", "20:00", 2), SH("N", "20:00", "08:00", 1)], opts: { rhythm: { on: true, wMin: 5, wMax: 7, oMin: 3, oMax: 4 }, min_rest_h: 8 }, people: P(10) }),
  room_gc: () => fixture({ mode: "rooms", dept: { min_gap: 2, general_rooms: 1 }, opts: { wr: { on: true, off: [1, 1, 1, 3, 3, 1, 1], track: [0, 0, 0, 1, 1, 0, 0], max: [0, 0, 0, 1, 1, 0, 0], sat: { on: false, max: 0, need: 3 }, fz: true }, leave_prop: true, quota_month: "2026-11" },
    people: P(6), prefs: { 2: iz(9, 13), 4: { 6: "yes", 20: "avoid" } } }),
  room_rhythm_bycap: () => fixture({ mode: "rooms", dept: { min_gap: 2, general_rooms: 2, fill_policy: "by_capacity" }, opts: { rhythm: { on: true, wMin: 2, wMax: 3, oMin: 2, oMax: 3 }, min_rest_h: 8 }, people: P(7) }),
  noduty_must_pin: () => fixture({ shifts: [SH("V", "08:00", "20:00")], opts: { pins: [{ pid: uid(1), days: "3", si: "" }] }, people: [{ name: "Yön", noDuty: true }, ...P(3)], prefs: { 0: { 7: "must" } } }),
  all_noduty: () => fixture({ shifts: [SH("V", "08:00", "20:00")], opts: {}, people: [{ name: "A", noDuty: true }, { name: "B", noDuty: true }] }),
  no_slots: () => fixture({ shifts: [SH("V", "08:00", "20:00", 1, [0, 0, 0, 0, 0, 0, 0])], opts: {}, people: P(3) }),
  h24_fixed: () => fixture({ dept: { pattern_on: 1, pattern_off: 2 }, shifts: [SH("24", "08:00", "08:00")], opts: { min_rest_h: 0 }, people: P(3) }),
  gen_mix: () => fixture({ shifts: [SH("G", "08:00", "20:00", 2), SH("N", "20:00", "08:00", 2)], opts: { gen: { mode: "mix" }, min_rest_h: 8, people: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [uid(i + 1), { g: i < 4 ? "k" : "e" }])) }, people: P(10), prefs: { 0: iz(3, 9) } }),
  gen_mix_impossible: () => fixture({ shifts: [SH("G", "08:00", "20:00", 2), SH("N", "20:00", "08:00", 2)], opts: { gen: { mode: "mix" }, min_rest_h: 8, people: Object.fromEntries(Array.from({ length: 8 }, (_, i) => [uid(i + 1), { g: i < 1 ? "k" : "e" }])) }, people: P(8) }),
  icu_full: () => fixture({ shifts: [SH("Gündüz", "08:00", "20:00", 2), SH("Gece", "20:00", "08:00", 2)],
    opts: { sen: { on: true, th: 3, hiMin: 1, loMin: 1, scope: "shift" }, gen: { mode: "spread" }, rhythm: { on: true, wMin: 2, wMax: 2, oMin: 2, oMax: 4 }, min_rest_h: 8,
      people: Object.fromEntries(Array.from({ length: 11 }, (_, i) => [uid(i + 1), { sv: i < 5 ? 5 : 1, g: i % 3 ? "k" : "e" }])) },
    people: P(11), prefs: { 2: iz(12, 15), 7: { 20: "must", 21: "must" } } }),
  senq_mismatch: () => fixture({ shifts: [SH("G", "08:00", "20:00", 1), SH("N", "20:00", "08:00", 1)], opts: { sen: { on: true, th: 3, hiMin: 0, loMin: 0 }, senq: { on: true, hi: 10, lo: 12 }, min_rest_h: 8,
    people: Object.fromEntries(Array.from({ length: 6 }, (_, i) => [uid(i + 1), { sv: i < 3 ? 5 : 1 }])) }, people: P(6) }),
  sen_no_values: () => fixture({ shifts: [SH("G", "08:00", "20:00", 2)], opts: { sen: { on: true, th: 3, hiMin: 1, loMin: 1 } }, people: P(5) }),
  r_hours_week: () => fixture({ shifts: [SH("G", "08:00", "20:00", 2), SH("N", "20:00", "08:00", 2)], opts: { min_rest_h: 8, rules: [{ id: "h1", t: "lim", who: { k: "all" }, op: "max", n: 48, what: "hours", per: "week" }] }, people: P(10), prefs: { 0: iz(9, 15) } }),
  r_nights: () => fixture({ shifts: [SH("G", "08:00", "20:00", 2), SH("N", "20:00", "08:00", 2)], opts: { min_rest_h: 8, rules: [{ id: "n1", t: "lim", who: { k: "all" }, op: "max", n: 2, what: "night", per: "row" }, { id: "n2", t: "after", who: { k: "all" }, what: "night", n: 2 }, { id: "n3", t: "lim", who: { k: "all" }, op: "max", n: 6, what: "night", per: "month" }] }, people: P(10) }),
  r_weekend: () => fixture({ shifts: [SH("G", "08:00", "20:00", 1), SH("N", "20:00", "08:00", 1)], opts: { min_rest_h: 8, rules: [{ id: "w1", t: "wkfull", who: { k: "all" } }, { id: "w2", t: "lim", who: { k: "all" }, op: "max", n: 2, what: "weekend", per: "month" }] }, people: P(8) }),
  r_wksplit: () => fixture({ shifts: [SH("G", "08:00", "20:00", 2), SH("N", "20:00", "08:00", 1)], opts: { min_rest_h: 8, rules: [{ id: "s1", t: "wkfull", mode: "split", who: { k: "all" } }] }, people: P(9) }),
  r_wksplit_tight: () => fixture({ shifts: [SH("G", "08:00", "20:00", 2), SH("N", "20:00", "08:00", 2)], opts: { min_rest_h: 8, rules: [{ id: "s1", t: "wkfull", mode: "split", who: { k: "all" } }] }, people: P(6) }),
  wr_acil_sat: () => fixture({ mode: "rooms", dept: { work_model: "duty_work", min_gap: 1, general_rooms: 2 }, opts: { wr: { on: true, def: 0, sp: [0, 0, 0, 0, 0, 1, 0], off: [0, 0, 0, 0, 0, 1, 0], track: [0, 0, 0, 0, 0, 0, 0], max: [0, 0, 0, 0, 0, 0, 0], sat: { on: false, need: 3, max: 1 }, fz: false, since: "2026-11", base: {} } }, people: P(6) }),
  r_skills: () => fixture({ shifts: [SH("Triyaj", "08:00", "20:00", 1), SH("Genel", "08:00", "20:00", 2), SH("Gece", "20:00", "08:00", 2)],
    opts: { min_rest_h: 8, people: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [uid(i + 1), { tags: [...(i < 5 ? ["Triyaj"] : []), ...(i % 3 === 0 ? ["YB"] : [])] }])),
      rules: [{ id: "o1", t: "only", tag: "Triyaj", si: 0 }, { id: "k1", t: "need", tag: "YB", n: 1, scope: "shift", si: 2 }] }, people: P(12) }),
  r_pair: () => fixture({ shifts: [SH("V", "08:00", "20:00", 2)], opts: { rules: [{ id: "p1", t: "pair", a: uid(1), b: uid(2), mode: "never" }, { id: "p2", t: "pair", a: uid(3), b: uid(4), mode: "same" }] }, people: P(6) }),
  r_cycle: () => fixture({ shifts: [SH("G", "08:00", "20:00", 2), SH("N", "20:00", "08:00", 2)], opts: { min_rest_h: 8, rules: [{ id: "c1", t: "cycle", who: { k: "all" }, pat: "GGNN----" }] }, people: P(8) }),
  r_cycle_leave: () => fixture({ shifts: [SH("G", "08:00", "20:00", 2), SH("N", "20:00", "08:00", 2)], opts: { min_rest_h: 8, rules: [{ id: "c1", t: "cycle", who: { k: "all" }, pat: "GGNN----" }] }, people: P(9), prefs: { 2: iz(10, 12) } }),
  r_staff_bay: () => fixture({ dept: { bayram: "1,2,3" }, shifts: [SH("G", "08:00", "20:00", 2), SH("N", "20:00", "08:00", 2)], opts: { min_rest_h: 8, rules: [{ id: "s1", t: "staff", si: -1, sel: "bay", n: 1 }, { id: "s2", t: "staff", si: 1, sel: "wd", wd: [0, 0, 0, 0, 0, 1, 1], n: 1 }] }, people: P(8) }),
  r_icap: () => fixture({ shifts: [SH("G", "08:00", "20:00", 2), SH("N", "20:00", "08:00", 2), SH("İcap", "08:00", "08:00", 1, D7, { icap: true })], opts: { min_rest_h: 8 }, people: P(10) }),
  r_parttime: () => fixture({ shifts: [SH("V", "08:00", "20:00", 2)], opts: { people: { [uid(1)]: { ratio: 50 } } }, people: P(6) }),
  r_impossible_lim: () => fixture({ shifts: [SH("V", "08:00", "20:00", 1)], opts: { rules: [{ id: "x1", t: "lim", who: { k: "all" }, op: "max", n: 4, what: "duty", per: "month" }] }, people: P(5) }),
  r_combo: () => fixture({ shifts: [SH("G", "08:00", "20:00", 2), SH("N", "20:00", "08:00", 2), SH("İcap", "08:00", "08:00", 1, D7, { icap: true })],
    opts: { min_rest_h: 8, rhythm: { on: true, wMin: 2, wMax: 3, oMin: 2, oMax: 4 },
      people: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [uid(i + 1), { tags: i % 4 === 0 ? ["YB"] : [], g: i % 2 ? "k" : "e" }])), gen: { mode: "mix" },
      rules: [{ id: "a", t: "lim", who: { k: "all" }, op: "max", n: 48, what: "hours", per: "week" }, { id: "b", t: "after", who: { k: "all" }, what: "night", n: 2 }, { id: "c", t: "need", tag: "YB", n: 1, scope: "day", si: -1 }, { id: "d", t: "pair", a: uid(2), b: uid(3), mode: "never" }] },
    people: P(12), prefs: { 5: iz(16, 20), 7: { 9: "must" } } }),
  // ---- yeni: vardiya kimleri, sabit mesai, vardiyaya özel istek, vardiya kuralları, kıdem koruması ----
  n_who_deny: () => fixture({ shifts: [SH("G", "08:00", "20:00", 2), SH("N", "20:00", "08:00", 2, D7, { deny: [uid(1), uid(2)] }), SH("U", "08:00", "24:00", 1, D7, { only: [uid(3), uid(4), uid(5)] })], opts: { min_rest_h: 11 }, people: P(10) }),
  n_mesai: () => fixture({ shifts: [SH("G", "08:00", "20:00", 2), SH("N", "20:00", "08:00", 2)], dept: { bayram: "10" },
    opts: { min_rest_h: 11, people: { [uid(1)]: { ms: { on: true, d: [["08:00", "18:00"], ["08:00", "18:00"], ["08:00", "18:00"], ["08:00", "18:00"], ["08:00", "18:00"], ["08:00", "13:00"], null] } }, [uid(2)]: { ms: { on: true, hol: true, d: [["09:00", "17:00"], null, ["09:00", "17:00"], null, ["09:00", "17:00"], null, null] } } } },
    people: P(10), prefs: { 0: iz(16, 18) } }),
  n_shpref: () => fixture({ shifts: [SH("G", "08:00", "20:00", 2, D7, { sid: "g" }), SH("N", "20:00", "08:00", 2, D7, { sid: "n" })], opts: { min_rest_h: 11 }, people: P(9),
    prefs: { 0: { _sh: { 23: { n: "must" }, 24: { g: "never" } } }, 1: { _sh: { 5: { g: "must" }, 6: { n: "never" }, 7: { g: "never", n: "never" } } }, 2: { 9: "izin", _sh: { 12: { n: "yes" }, 13: { g: "avoid" } } } } }),
  n_shrules: () => fixture({ shifts: [SH("G", "08:00", "20:00", 3), SH("N", "20:00", "08:00", 3), SH("U", "08:00", "24:00", 1)], opts: { min_rest_h: 11,
    rules: [{ id: "c", t: "lim", who: { k: "all" }, op: "max", n: 1, what: "shift", si: 2, per: "week", hard: true }, { id: "e", t: "eq", who: { k: "all" }, si: 2 },
      { id: "a", t: "after", who: { k: "all" }, what: "night", n: 2, hard: true }, { id: "r", t: "lim", who: { k: "all" }, op: "max", n: 2, what: "night", per: "row", hard: true }] }, people: P(14) }),
  n_guard_time: () => fixture({ shifts: [SH("G", "08:00", "20:00", 2), SH("N", "20:00", "08:00", 2), SH("U", "08:00", "24:00", 1)], opts: { min_rest_h: 11,
    sen: { on: true, mode: "guard", th: 3, hiMin: 1, loMin: 0, scope: "time" }, people: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [uid(i + 1), { sv: i < 5 ? 5 : 1 }])) }, people: P(12) }),
  n_guard_shift: () => fixture({ shifts: [SH("G", "08:00", "20:00", 3), SH("N", "20:00", "08:00", 2)], opts: { min_rest_h: 11,
    sen: { on: true, mode: "guard", th: 3, hiMin: 1, loMin: 0, scope: "shift" }, people: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [uid(i + 1), { sv: i < 4 ? 5 : 1 }])) }, people: P(12) }),
  n_dneed: () => fixture({ shifts: [SH("G", "08:00", "20:00", 3, D7, { sid: "g" }), SH("N", "20:00", "08:00", 2, D7, { sid: "n" })], opts: { min_rest_h: 11, dneed: { "2026-11": { "15|g": 1, "20|n": 0, "21|g": 5 } } }, people: P(12) }),
  // ---- kural motoru: kayan pencere, boş gün, art arda hafta sonu, yasak sıra, art arda k sonrası izin ----
  x_roll_hours: () => fixture({ shifts: [SH("G", "08:00", "20:00", 2), SH("N", "20:00", "08:00", 2)], opts: { min_rest_h: 11, rules: [{ id: "rh", t: "lim", who: { k: "all" }, op: "max", n: 48, what: "hours", per: "roll", win: 7, hard: true }] }, people: P(10), prefs: { 0: iz(9, 12) } }),
  x_off_roll: () => fixture({ shifts: [SH("G", "08:00", "20:00", 2), SH("N", "20:00", "08:00", 2)], opts: { min_rest_h: 11, rules: [{ id: "o14", t: "lim", who: { k: "all" }, op: "min", n: 4, what: "off", per: "roll", win: 14, hard: true }, { id: "ow", t: "lim", who: { k: "all" }, op: "min", n: 1, what: "off", per: "week", hard: true }] }, people: P(8) }),
  x_off_row: () => fixture({ shifts: [SH("G", "08:00", "20:00", 2), SH("N", "20:00", "08:00", 2)], opts: { min_rest_h: 11, rules: [{ id: "or", t: "lim", who: { k: "all" }, op: "min", n: 2, what: "off", per: "row", hard: true }, { id: "an", t: "after", who: { k: "all" }, what: "night", n: 1 }] }, people: P(9), prefs: { 3: iz(14, 14) } }),
  x_wk_row: () => fixture({ shifts: [SH("G", "08:00", "20:00", 1), SH("N", "20:00", "08:00", 1)], opts: { min_rest_h: 11, rules: [{ id: "wr", t: "lim", who: { k: "all" }, op: "max", n: 1, what: "weekend", per: "row", hard: true }] }, people: P(6) }),
  x_wk_roll: () => fixture({ shifts: [SH("G", "08:00", "20:00", 1), SH("N", "20:00", "08:00", 1)], opts: { min_rest_h: 11, rules: [{ id: "wl", t: "lim", who: { k: "all" }, op: "max", n: 1, what: "weekend", per: "roll", win: 3, hard: true }] }, people: P(9) }),
  x_seq: () => fixture({ shifts: [SH("S", "07:00", "15:00", 2), SH("A", "15:00", "23:00", 2), SH("G", "23:00", "07:00", 2)], opts: { min_rest_h: 8, rules: [{ id: "q1", t: "seq", who: { k: "all" }, fa: "1", fb: "0", hard: true }, { id: "q2", t: "seq", who: { k: "all" }, fa: "2", fb: "0", hard: true }, { id: "q3", t: "seq", who: { k: "all" }, fa: "2", fb: "1", hard: true }] }, people: P(12) }),
  x_after_k: () => fixture({ shifts: [SH("G", "08:00", "20:00", 2), SH("N", "20:00", "08:00", 2)], opts: { min_rest_h: 11, rules: [{ id: "ak", t: "after", who: { k: "all" }, what: "night", n: 2, k: 2, hard: true }, { id: "nr", t: "lim", who: { k: "all" }, op: "max", n: 3, what: "night", per: "row", hard: true }] }, people: P(10) }),
  x_off_month_imp: () => fixture({ shifts: [SH("G", "08:00", "20:00", 2), SH("N", "20:00", "08:00", 2)], opts: { min_rest_h: 11, rules: [{ id: "om", t: "lim", who: { k: "all" }, op: "min", n: 17, what: "off", per: "month" }] }, people: P(8) }),
  x_roll_imp: () => fixture({ shifts: [SH("V", "08:00", "20:00", 3)], opts: { min_rest_h: 8, rules: [{ id: "r2", t: "lim", who: { k: "all" }, op: "max", n: 2, what: "duty", per: "roll", win: 7 }] }, people: P(5) }),
  x_nhs: () => fixture({ shifts: [SH("G", "08:00", "20:00", 2), SH("U", "08:00", "22:00", 1), SH("N", "20:00", "08:00", 2)], opts: { min_rest_h: 11, rules: [
      { id: "h72", t: "lim", who: { k: "all" }, op: "max", n: 72, what: "hours", per: "roll", win: 7, hard: true },
      { id: "n4", t: "lim", who: { k: "all" }, op: "max", n: 4, what: "night", per: "row", hard: true },
      { id: "a46", t: "after", who: { k: "all" }, what: "night", n: 2, hard: true },
      { id: "d7", t: "lim", who: { k: "all" }, op: "max", n: 7, what: "duty", per: "row", hard: true },
      { id: "w12", t: "lim", who: { k: "all" }, op: "max", n: 1, what: "weekend", per: "roll", win: 2 },
      { id: "o14", t: "lim", who: { k: "all" }, op: "min", n: 2, what: "off", per: "roll", win: 14, hard: true }] }, people: P(14), prefs: { 1: iz(3, 9), 6: { 17: "must" } } }),
  x_rooms_asistan: () => fixture({ mode: "rooms", dept: { min_gap: 1, general_rooms: 2 }, opts: { rules: [{ id: "m8", t: "lim", who: { k: "all" }, op: "max", n: 8, what: "duty", per: "month", hard: true }, { id: "r3", t: "lim", who: { k: "all" }, op: "max", n: 1, what: "duty", per: "roll", win: 3, hard: true }, { id: "w1", t: "lim", who: { k: "all" }, op: "min", n: 1, what: "off", per: "roll", win: 7, hard: true }] }, people: P(9), prefs: { 2: iz(10, 14) } }),
  x_big_acgme: () => fixture({ shifts: [SH("G", "07:00", "19:00", 6), SH("N", "19:00", "07:00", 4), SH("K", "07:00", "15:00", 3, [1, 1, 1, 1, 1, 0, 0])], opts: { min_rest_h: 8, rules: [
      { id: "h320", t: "lim", who: { k: "all" }, op: "max", n: 320, what: "hours", per: "roll", win: 28, hard: true }, { id: "o4", t: "lim", who: { k: "all" }, op: "min", n: 4, what: "off", per: "roll", win: 28, hard: true },
      { id: "w1", t: "lim", who: { k: "all" }, op: "min", n: 1, what: "off", per: "week", hard: true }, { id: "nr", t: "lim", who: { k: "all" }, op: "max", n: 3, what: "night", per: "row" },
      { id: "nd", t: "seq", who: { k: "all" }, fa: "N", fb: "D", hard: true }, { id: "wk", t: "lim", who: { k: "all" }, op: "max", n: 1, what: "weekend", per: "roll", win: 2 }] }, people: P(30), prefs: { 3: iz(1, 7), 9: iz(20, 30) } }),
  x_wk_type: () => fixture({ shifts: [SH("G", "08:00", "20:00", 2), SH("N", "20:00", "08:00", 2)], opts: { min_rest_h: 11, rules: [{ id: "wt", t: "wkfull", who: { k: "all" }, mode: "type", hard: true }, { id: "ws", t: "wkfull", who: { k: "all" } }] }, people: P(10) }),
  x_long: () => fixture({ shifts: [SH("G", "08:00", "20:00", 1), SH("N", "20:00", "08:00", 1), SH("K", "08:00", "16:00", 2)], opts: { min_rest_h: 11, rules: [{ id: "l2", t: "lim", who: { k: "all" }, op: "max", n: 2, what: "long", lh: 10, per: "row", hard: true }, { id: "lr", t: "after", who: { k: "all" }, what: "long", lh: 10, k: 2, n: 1, hard: true }, { id: "lw", t: "lim", who: { k: "all" }, op: "max", n: 3, what: "long", lh: 10, per: "roll", win: 7 }] }, people: P(9) }),
  x_crew: () => fixture({ shifts: [SH("G", "08:00", "20:00", 2), SH("N", "20:00", "08:00", 2)], opts: { min_rest_h: 0, people: Object.fromEntries(Array.from({ length: 8 }, (_, i) => [uid(i + 1), { tags: ["Ekip " + "ABCD"[i >> 1]] }])), rules: "ABCD".split("").map((x, k) => ({ id: "c" + x, t: "cycle", who: { k: "tag", tag: "Ekip " + x }, pat: "GGNN----", start: "2026-11-0" + (1 + 2 * k) })) }, people: P(8), prefs: { 2: { 12: "izin" } } }),
  x_pts: () => fixture({ shifts: [SH("G", "08:00", "20:00", 2), SH("N", "20:00", "08:00", 2, [1, 1, 1, 1, 1, 1, 1], { pts: 2 })], dept: { bayram: "29" }, opts: { min_rest_h: 11, pts: { on: true, n: 0, we: 1, bay: 2 }, rules: [{ id: "a", t: "after", who: { k: "all" }, what: "night", n: 1 }] }, people: P(10), prefs: { 4: iz(5, 9) } }),
  fixed_vs_leave: () => fixture({ dept: { pattern_on: 2, pattern_off: 2 }, shifts: [SH("V", "08:00", "20:00", 2)], opts: { min_rest_h: 8 }, people: P(4), prefs: { 0: iz(5, 6), 2: iz(17, 19) } }),
};

async function run(name, opt = {}) {
  const F = SC[name]();
  const t0 = Date.now();
  const { w, E, errors } = await openApp(F);
  let res = null, alerts = [];
  try { E("generate()"); res = E("draft"); } catch (e) { errors.push("generate: " + e.message); }
  alerts = w.__alerts || [];
  const ms = Date.now() - t0;
  const out = { name, ms, errors: errors.slice(0, 3), alerts };
  if (!res) { out.note = "taslak yok"; return out; }
  const fill = F.db.departments[0].fill_policy === "fill_all";
  const c = check(F, res, { allowEmpty: true, allowRhythm: true, allowSen: true, allowGen: true, allowRules: true, targets: true, nights: true });
  const warn = (res.viol || []).filter(v => !/^(ℹ️|💡)/.test(v));
  out.exact = res.exact; out.empty = res.emptyCount; out.rep = res.rep; out.warn = warn.length;
  out.checker = c.problems; out.rhythmV = c.info.rhythmV; out.senV = c.info.senV; out.genV = c.info.genV; out.ruleV = c.info.ruleV; out.ruleDet = (c.info.ruleDet || []).slice(0, 3); out.icap = c.info.icap;
  // SESSİZ HATA: denetçi sorun buluyor ama uygulama "tamam" diyor
  const realIssue = c.problems.length || (fill && c.info.empty > 0) || c.info.rhythmV > 0 || (c.info.senV || 0) > 0 || (c.info.genV || 0) > 0 || (c.info.ruleV || 0) > 0;
  out.SILENT = realIssue && res.exact && warn.length === 0;
  out.hardBug = check(F, res, { allowEmpty: true, allowRhythm: true, allowSen: true, allowGen: true, allowRules: true, mustSoft: true }).problems.filter(p => !/istendi/.test(p));
  // öneriler
  if (E("altAny(draft)") && !opt.noAlt) {
    for (let i = 0; i < 240; i++) { await new Promise(r => setTimeout(r, 250)); if (!E("ALT.busy")) break; }
    const L = E("ALT.list.map(f=>({k:f.k,parts:f.parts||[f.k],t:f.title,res:f.res,rr:f.ov&&f.ov.rr||null,pat:f.ov&&f.ov.pat||null,sen:f.ov&&f.ov.sen||null,gen:f.ov&&f.ov.gen||null,minRest:f.ov&&f.ov.minRest,off:f.ov&&f.ov.rulesOff||null,rel:f.ov&&f.ov.rulesRel||null,dneed:f.ov&&f.ov.dneed||null}))");
    out.why = E("ALT.why&&ALT.why.txt") || null;
    out.alts = L.map(a => {
      const F2 = JSON.parse(JSON.stringify(F)); const D = F2.db.departments[0];
      if (a.rr) { D.opts.rhythm = a.rr; } if (a.pat) { D.pattern_on = a.pat.on; D.pattern_off = a.pat.off; } if (a.sen) D.opts.sen = a.sen; if (a.gen) D.opts.gen = a.gen;
      if (a.off) D.opts.rules = (D.opts.rules || []).filter(r => !a.off.includes(r.id)); if (a.rel) D.opts.rules = (D.opts.rules || []).map(r => a.rel[r.id] ? { ...r, ...a.rel[r.id] } : r); if (a.minRest != null) D.opts.min_rest_h = a.minRest;
      const cc = check(F2, a.res, { allowEmpty: a.parts.includes("keep") || a.k === "base", allowRhythm: a.k === "base", allowSen: a.k === "base", allowGen: a.k === "base", allowRules: a.k === "base", dneed: a.dneed || undefined });
      return { k: a.k, t: a.t, ok: cc.ok, prob: cc.problems.slice(0, 2), empty: cc.info.empty };
    });
    out.altMs = Date.now() - t0 - ms;
  }
  return out;
}
(async () => {
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SC);
  const all = [];
  for (const nm of names) {
    let r; try { r = await run(nm); } catch (e) { r = { name: nm, crash: String(e.stack || e).slice(0, 300) }; }
    all.push(r);
    // katı kural bozulduysa: taslakta yazıyorsa (imkânsız kurulum) 🟡, yazmıyorsa 🟠
    const hb = r.hardBug && r.hardBug.length, said = r.warn > 0 && !r.exact;
    const flag = r.crash ? "💥" : r.SILENT ? "🔴SESSİZ" : hb && !said ? "🟠KURAL" : (r.errors && r.errors.length) ? "🟠JS" : hb ? "🟡BİLDİRİLDİ" : "🟢";
    console.log(`${flag} ${nm} ${r.ms || ""}ms exact=${r.exact} empty=${r.empty} warn=${r.warn} rhythmV=${r.rhythmV} senV=${r.senV} genV=${r.genV} ruleV=${r.ruleV}${r.alerts && r.alerts.length ? " alert=" + JSON.stringify(r.alerts) : ""}`);
    if (r.crash) console.log("   ", r.crash);
    if (r.errors && r.errors.length) console.log("   JS:", r.errors.join(" | ").slice(0, 300));
    if (r.hardBug && r.hardBug.length) console.log("   KURAL:", r.hardBug.slice(0, 3).join(" | "));
    if (r.checker && r.checker.length) console.log("   denetçi:", r.checker.slice(0, 3).join(" | ").slice(0, 300));
    if (r.ruleV) console.log("   kural:", r.ruleDet.join(" | ").slice(0, 300));
    if (r.icap) console.log("   icap:", JSON.stringify(Object.values(r.icap)));
    if (r.why) console.log("   neden:", r.why.replace(/<[^>]+>/g, "").slice(0, 200));
    if (r.alts) r.alts.forEach((a, i) => console.log(`   öneri ${i + 1} [${a.k}] ${a.ok ? "✓" : "✗"} ${a.t}${a.empty ? " boş=" + a.empty : ""}${a.ok ? "" : " → " + a.prob.join(" | ")}`));
    if (r.alts) console.log("   öneri süresi", r.altMs, "ms");
  }
  const bad = all.filter(r => r.crash || r.SILENT || (r.hardBug && r.hardBug.length && !(r.warn > 0 && !r.exact)) || (r.errors && r.errors.length) || (r.alts || []).some(a => !a.ok && a.k !== "base"));
  console.log(`BATARYA: ${all.length} senaryo, ${bad.length} sorunlu${bad.length ? " → " + bad.map(r => r.name).join(", ") : ""}`);
  process.exitCode = bad.length ? 1 : 0;
  require("fs").mkdirSync(__dirname + "/out", { recursive: true }); require("fs").writeFileSync(__dirname + "/out/battery_out.json", JSON.stringify(all, null, 1));
  process.exit(process.exitCode);
})();
