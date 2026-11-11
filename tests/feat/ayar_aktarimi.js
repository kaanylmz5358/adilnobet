const { openApp, fixture, SH, uid, DEPT } = require("../lib/harness");
const P = k => Array.from({ length: k }, (_, i) => ({ name: "Kişi" + String.fromCharCode(65 + i) }));
const fails = []; const ok = (c, m) => { console.log((c ? "✓ " : "✗ ") + m); if (!c) fails.push(m); };
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const F = fixture({ shifts: [SH("G", "08:00", "20:00", 2, undefined, { sid: "g" }), SH("N", "20:00", "08:00", 2, undefined, { sid: "n" })],
    opts: { min_rest_h: 8, rules: [{ id: "own", t: "lim", who: { k: "all" }, op: "max", n: 6, what: "night", per: "month", on: true }], pins: [{ pid: uid(2), days: "5", si: 1 }] }, people: P(6) });
  const B = "d0000000-0000-4000-8000-0000000000bb";
  F.db.departments.push({ id: B, name: "Yoğun Bakım B", join_code: "XYZ999", month: "2026-11", sched_mode: "shifts", min_gap: 1, general_rooms: 1, branch_rooms: {}, work_model: "shift_only", pattern_on: 0, pattern_off: 0, fill_policy: "fill_all", bayram: "",
    shifts: [SH("Gündüz", "07:00", "19:00", 2, undefined, { sid: "x1", brk: 30, owner: uid(9) }), SH("Gece", "19:00", "07:00", 2, undefined, { sid: "x2", pts: 2, deny: [uid(8)] })], shift_overrides: [],
    opts: { setup_done: true, min_rest_h: 11, bal_dn: true, partner_mode: "off", pts: { on: true, n: 1, we: 1, bay: 2 }, leave_cap: 2, req_lim: { year: 14, never: 4 }, open_mode: "approve",
      rhythm: { on: true, wMin: 2, wMax: 2, oMin: 2, oMax: 3 }, sen: { on: true, mode: "guard", th: 3, hiMin: 1, loMin: 0, scope: "time" }, gen: { mode: "mix" },
      rules: [{ id: "h72", t: "lim", who: { k: "all" }, op: "max", n: 72, what: "hours", per: "roll", win: 7, hard: true, on: true },
        { id: "nd", t: "seq", who: { k: "all" }, fa: "1", fb: "0", on: true }, { id: "sh", t: "lim", who: { k: "all" }, op: "max", n: 3, what: "shift", si: 1, per: "week", on: true },
        { id: "pr", t: "pair", a: uid(8), b: uid(9), mode: "never", on: true }, { id: "pp", t: "lim", who: { k: "p", ids: [uid(8)] }, op: "max", n: 2, what: "duty", per: "week", on: true },
        { id: "tg", t: "need", tag: "Triyaj", n: 1, scope: "shift", si: -1, on: true }] } });
  F.db.memberships.push({ user_id: uid(1), dept_id: B, name: "KişiA", pool: "", quota: 0, is_admin: true, is_test: false, shift_prefs: {} });
  F.db.memberships.find(m => m.user_id === uid(3) && m.dept_id === DEPT).shift_prefs = { allowed: [true, false] };
  const { E, db, errors } = await openApp(F); if (!E("!!dept")) { await E(`openTeam('${DEPT}')`); await wait(300); }
  E("window.__t=[];toast=(m)=>__t.push(String(m));confirm=()=>true");
  E("showTab('kurulum');setPage('aktar')");
  ok(E("grpVisible('aktar')"), "Ayar aktarımı sayfası yöneticide görünüyor");
  ok(/Yoğun Bakım B/.test(E("document.getElementById('copyBox').innerHTML")), "kaynak listesinde öteki ekip");
  await E(`copyPick('${B}')`); await wait(200);
  const parts = E("copyParts(CP.pack).map(x=>x.k+': '+x.txt)"); parts.forEach(p => console.log("   ", p.slice(0, 200)));
  ok(parts.length >= 7, "bölümler listelendi (" + parts.length + ")");
  ok(/2 kural bu ekibin vardiyalarına uymuyor/.test(parts.find(p => p.startsWith("rules"))), "vardiyaya bağlı 2 kural uymuyor uyarısı");
  ok(!/Kişi/.test(parts.find(p => p.startsWith("rules"))), "kişiye bağlı kurallar (iki kişi, belirli kişi) aktarılmıyor");
  ok(E("CP.sel.shifts") === false && E("CP.sel.rules") === true, "varsayılan: vardiyalar seçili değil, kurallar seçili");
  // 1. aşama: vardiyasız aktar (kurallar, sınırlar, dağıtım)
  E("CP.sel={rules:true,lim:true,dist:true}"); await E("copyApply()"); await wait(800);
  let D = db.departments.find(d => d.id === DEPT);
  ok(D.opts.rules.length === 3, "2 uyumlu kural eklendi + kendi kuralı korundu (" + D.opts.rules.map(r => r.t).join(",") + ")");
  ok(D.opts.leave_cap === 2 && D.opts.req_lim.year === 14 && D.opts.open_mode === "approve", "izin/istek/açık nöbet ayarları geldi");
  ok(D.opts.pts && D.opts.pts.on && D.opts.partner_mode === "off", "dağıtım ve puan ayarları geldi");
  ok(D.shifts.length === 2 && D.shifts[0].start === "08:00", "vardiyalara dokunulmadı");
  ok(D.opts.min_rest_h === 8 && !(D.opts.rhythm && D.opts.rhythm.on), "seçilmeyen bölümler (dinlenme, ritim) değişmedi");
  // 2. aşama: vardiyalarla birlikte kurallar
  await E(`copyPick('${B}')`); await wait(200);
  E("CP.sel={shifts:true,rules:true,rest:true,rhythm:true,sen:true}"); await E("copyApply()"); await wait(900);
  D = db.departments.find(d => d.id === DEPT);
  ok(D.shifts.length === 2 && D.shifts[0].start === "07:00" && D.shifts[0].brk === 30 && D.shifts[1].pts === 2, "vardiyalar (mola ve puanıyla) geldi");
  ok(!D.shifts[0].owner && !D.shifts[1].deny, "kişiye bağlı vardiya ayarları (sahip, hariç) gelmedi");
  ok(D.shifts.every(x => x.sid && x.sid !== "x1" && x.sid !== "x2"), "yeni vardiya kimlikleri");
  const R = D.opts.rules; console.log("   kurallar:", R.map(r => r.t + (r.si != null ? ":" + r.si : "") + (r.fa ? ":" + r.fa + ">" + r.fb : "")).join(" "));
  ok(R.some(r => r.t === "seq" && r.fa === "1" && r.fb === "0") && R.some(r => r.t === "lim" && r.what === "shift" && r.si === 1), "vardiyaya bağlı kurallar da geldi (sıra aynen)");
  ok(R.filter(r => r.t === "lim" && r.what === "hours").length === 1, "aynı kural iki kez eklenmedi");
  ok(D.opts.min_rest_h === 11 && D.opts.rhythm.on && D.opts.sen.mode === "guard" && D.opts.gen.mode === "mix", "dinlenme, ritim, kıdem ve cinsiyet kuralları geldi");
  ok((D.opts.pins || []).every(p => p.si === ""), "sabit atamaların vardiyası temizlendi (gün kaldı)");
  ok(!db.memberships.find(m => m.user_id === uid(3) && m.dept_id === DEPT).shift_prefs.allowed, "kişinin vardiya izinleri sıfırlandı");
  // 3) ayar kodu
  const code = E("settingsCode()"); ok(/^ND1:/.test(code) && code.length > 100, "ayar kodu üretildi (" + code.length + " karakter)");
  ok(!/Kişi[A-Z]/.test(Buffer.from(code.slice(4), "base64").toString("utf8")), "kodda kişi adı yok");
  E("CP={src:'__kod',pack:null,sel:{},msg:''}"); E(`copyCode(${JSON.stringify(code)})`);
  ok(E("!!CP.pack&&CP.pack.v===1"), "kod çözüldü");
  E("copyCode('ND1:bozuk')"); ok(/okunamadı/.test(E("CP.msg")), "bozuk kod reddedildi");
  if (errors.length) { console.log(errors.slice(0, 3)); fails.push("js"); }
  console.log("SONUÇ:", fails.length ? fails.length + " hata: " + fails.join(" / ") : "TAMAM");
  process.exit(0);
})();
