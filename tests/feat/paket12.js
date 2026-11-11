/* Paket 12: uzun vardiya, vardiya süresi, ekip döngüsü, zor nöbet puanı, yıllık izin, açık nöbet */
const { openApp, fixture, SH, uid } = require("../lib/harness");
const { check } = require("../lib/checker");
const P = k => Array.from({ length: k }, (_, i) => ({ name: "Kişi" + String.fromCharCode(65 + i) }));
const iz = (a, b) => { const o = {}; for (let d = a; d <= b; d++) o[d] = "izin"; return o; };
const fails = []; const ok = (c, m) => { console.log((c ? "✓ " : "✗ ") + m); if (!c) fails.push(m); };
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  // ---------- 1) uzun vardiya ----------
  { const F = fixture({ shifts: [SH("G", "08:00", "20:00", 1), SH("N", "20:00", "08:00", 1), SH("K", "08:00", "16:00", 2)], opts: { min_rest_h: 11, rules: [
      { id: "l2", t: "lim", who: { k: "all" }, op: "max", n: 2, what: "long", lh: 10, per: "row", hard: true }, { id: "lr", t: "after", who: { k: "all" }, what: "long", lh: 10, k: 2, n: 1, hard: true }] }, people: P(9) });
    const { E, errors } = await openApp(F); E("generate()"); const dr = E("draft");
    const c = check(F, dr, { allowEmpty: true, allowRules: true });
    ok(dr.rep.ruleV === 0 && c.info.ruleV === 0, "uzun vardiya kuralları tuttu (uygulama " + dr.rep.ruleV + ", denetçi " + c.info.ruleV + ")");
    ok(dr.emptyCount === 0, "boş yer yok");
    ok(/uzun vardiya \(10 saatten uzun\)/.test(E("ruleText(rulesAll()[0])")), "metin: " + E("ruleText(rulesAll()[0])"));
    ok(/art arda 2 ya da daha fazla uzun vardiyadan/.test(E("ruleText(rulesAll()[1])")), "metin: " + E("ruleText(rulesAll()[1])"));
    // değerlendirici: üç uzun vardiya art arda yaz → ihlal
    const r = E(`(()=>{const slots=buildSlots(),{y,m,nDays}=monthInfo();const C=rulesCompile(slots,slots.map(()=>members.map(()=>null)),y,m,nDays,null);
      const A=slots.map(()=>-1);[3,4,5].forEach(d=>{A[slots.findIndex(s=>s.d===d&&s.si===0)]=0;});A[slots.findIndex(s=>s.d===6&&s.si===2)]=0;const e=ruleEval(C,A,true);return e.per})()`);
    ok(r.l2 === 1 && r.lr === 1, "değerlendirici: 3 uzun art arda → 1 + sonrasında izin yok → 1 " + JSON.stringify(r));
    if (errors.length) { console.log(errors.slice(0, 2)); fails.push("js1"); } }
  // ---------- 2) vardiya süresi ----------
  { const F = fixture({ shifts: [SH("G", "08:00", "20:00", 1), SH("N", "20:00", "08:00", 1), SH("K", "08:00", "16:00", 1)], opts: { rules: [{ id: "ln", t: "len", what: "all", n: 11 }, { id: "lg", t: "len", what: "night", n: 7.5 }] }, people: P(6) });
    const { E, errors } = await openApp(F);
    ok(JSON.stringify(E("lenIssues(rulesAll()[0])")) === JSON.stringify(["08:00–20:00 (12 saat)", "20:00–08:00 (12 saat)"]), "11 saat sınırı: " + JSON.stringify(E("lenIssues(rulesAll()[0])")));
    ok(E("lenIssues(rulesAll()[1]).length") === 1, "gece 7,5 saat: yalnız gece vardiyası");
    ok(E("ruleText(rulesAll()[1])") === "Gece vardiyaları en çok 7,5 saat sürsün", E("ruleText(rulesAll()[1])"));
    ok(!E("priKeys()").some(k => /ln|lg/.test(k)), "önem sırasında yok (listeye etkisi yok)");
    E("showTab('kurulum');setPage('vardiya');renderShifts()");
    ok(/kural: Vardiyalar en çok 11 saat/.test(E("document.getElementById('shiftList').textContent")), "vardiya kartında uyarı");
    E("generate()"); const dr = E("draft");
    ok((dr.viol || []).some(v => /Vardiyalar en çok 11 saat/.test(v)), "listede uyarı");
    ok(dr.rep.ruleV === 0, "kural ihlali sayısına girmiyor");
    E("setPage('kural');renderRules()"); ok(/Uymayan: 08:00–20:00/.test(E("document.getElementById('ruleList').textContent")), "Kurallar sayfasında uymayanlar");
    if (errors.length) { console.log(errors.slice(0, 2)); fails.push("js2"); } }
  // ---------- 3) ekip döngüsü ----------
  for (const mk of ["2026-11", "2026-12"]) {
    const tags = {}; for (let i = 0; i < 8; i++) tags[uid(i + 1)] = { tags: ["Ekip " + "ABCD"[i >> 1]] };
    const R = "ABCD".split("").map((x, k) => ({ id: "c" + x, t: "cycle", who: { k: "tag", tag: "Ekip " + x }, pat: "GGNN----", start: "2026-11-0" + (1 + 2 * k) }));
    const F = fixture({ month: mk, shifts: [SH("G", "08:00", "20:00", 2), SH("N", "20:00", "08:00", 2)], opts: { min_rest_h: 0, people: tags, rules: R }, people: P(8) });
    const { E, errors } = await openApp(F); E("generate()"); const dr = E("draft");
    const c = check(F, dr, { allowEmpty: true, allowRules: true });
    ok(dr.rep.ruleV === 0 && c.info.ruleV === 0 && dr.emptyCount === 0, `${mk}: 4 ekip döngüsü kusursuz (kural ${dr.rep.ruleV}, denetçi ${c.info.ruleV}, boş ${dr.emptyCount})`);
    const same = [0, 2, 4, 6].every(i => { for (let d = 1; d <= 28; d++) { const a = (dr.asg[d] || []).find(e => e.id === uid(i + 1)), b = (dr.asg[d] || []).find(e => e.id === uid(i + 2)); if (!!a !== !!b || (a && b && a.s !== b.s)) return false; } return true; });
    ok(same, `${mk}: aynı ekiptekiler aynı günlerde aynı vardiyada`);
    const d1 = E("ruleText(rulesAll()[1])"); ok(/1\. günü 3 Kasım 2026/.test(d1), "metin: " + d1);
    // A ekibi 1 Kasım'da başlar: Kasım'da 1-2 G, 3-4 N; Aralık 1 = 31 gün sonra → 31 mod 8 = 7 → izin
    const a1 = (dr.asg[1] || []).find(e => e.id === uid(1));
    ok(mk === "2026-11" ? (a1 && a1.s === 0) : !a1, `${mk}: A ekibinin 1. günü takvime bağlı (${a1 ? "vardiya " + a1.s : "izin"})`);
    if (errors.length) { console.log(errors.slice(0, 2)); fails.push("js3"); } }
  // ---------- 4) zor nöbet puanı ----------
  { const F = fixture({ shifts: [SH("G", "08:00", "20:00", 2), SH("N", "20:00", "08:00", 2, [1, 1, 1, 1, 1, 1, 1], { pts: 2 })], opts: { min_rest_h: 11, bal_dn: false, bal_we: false, pts: { on: true, n: 0, we: 1, bay: 2 } }, dept: { bayram: "29" }, people: P(10) });
    const { E, errors } = await openApp(F); E("generate()");
    const pts = E("schedPts(draft,planAy())"), cnt = E("draft.cnt");
    const per = Object.keys(pts).map(k => pts[k] / cnt[k]); const sp = Math.max(...per) - Math.min(...per);
    console.log("   puan/nöbet:", per.map(x => x.toFixed(2)).join(" "));
    ok(sp < 0.35, "nöbet başına puanlar birbirine yakın (fark " + sp.toFixed(2) + ")");
    ok(/puan/.test(E("document.getElementById('decideBody').textContent")), "karar tablosunda puan");
    E("ptsUI()"); ok(E("document.getElementById('ptsOn').checked") && E("document.querySelector('[data-pts]').style.display") === "", "ayar alanları görünür");
    E("showTab('kurulum');setPage('vardiya');openShSheet(1)"); ok(/Zor nöbet puanı/.test(E("document.getElementById('shSheetBody').textContent")), "vardiya perdesinde puan");
    E("shSetPts(3)"); ok(E("shiftRows[1].pts") === 3, "vardiya puanı değişti");
    if (errors.length) { console.log(errors.slice(0, 2)); fails.push("js4"); } }
  // ---------- 5) yıllık izin hakkı ----------
  { const F = fixture({ shifts: [SH("G", "08:00", "20:00", 2)], opts: { req_lim: { year: 5 }, people: { [uid(3)]: { ih: 6 } } }, people: P(5), prefs: { 1: { 3: "izin" }, 2: { 4: "izin" } } });
    F.db.prefs.push({ user_id: uid(2), dept_id: F.db.departments[0].id, month: "2026-10", days: iz(10, 13) });
    F.db.prefs.push({ user_id: uid(2), dept_id: F.db.departments[0].id, month: "2025-12", days: iz(1, 20) });
    const { E, errors } = await openApp(F); E("window.__t=[];toast=(m)=>__t.push(String(m))");
    ok(E(`yearUsed('${uid(2)}')`) === 5, "KişiB bu yıl 5 gün (Ekim 4 + Kasım 1; geçen yıl sayılmaz): " + E(`yearUsed('${uid(2)}')`));
    ok(E(`yearHak('${uid(3)}')`) === 6 && E(`yearHak('${uid(2)}')`) === 5, "kişiye özel hak 6, genel 5");
    E(`isAdmin=()=>false;editingId=()=>'${uid(2)}';canEdit=()=>true`); E("setBrush('izin')");
    ok(E("paintPref(20)") === false && /izin hakkı doldu/.test(E("__t.slice(-1)[0]")), "hak dolunca üye izin isteyemez: " + E("__t.slice(-1)[0]"));
    E(`editingId=()=>'${uid(3)}'`); ok(E("paintPref(20)") === true, "hakkı olan isteyebildi");
    E("isAdmin=()=>true"); E(`openPerson('${uid(2)}')`); ok(/bu yıl 5 gün izin/.test(E("document.getElementById('personSheetBody').textContent")), "kişi kartında kullanılan izin");
    E("renderLeaveAdmin()"); ok(/Yıllık: 5\/5 gün/.test(E("document.getElementById('leaveAdminList').textContent")), "izin onay panelinde yıllık durum");
    if (errors.length) { console.log(errors.slice(0, 2)); fails.push("js5"); } }
  // ---------- 6) açık nöbet ----------
  for (const mode of ["approve", "first"]) {
    const F = fixture({ month: "2026-12", shifts: [SH("G", "08:00", "20:00", 2)], opts: { open_mode: mode, min_rest_h: 8 }, people: P(6) });
    const { E, db, errors } = await openApp(F); E("window.__t=[];toast=(m)=>__t.push(String(m))");
    E("showTab('cizelge');generate()"); await E("confirmDecide()"); await wait(800);
    ok(!!E("schedulesAll['2026-12']"), `${mode}: liste yayınlandı`);
    // 20 Aralık'tan bir kişiyi çıkar (boş yer), A'yı 21'de çalışır yap
    const out20 = E("(()=>{viewMonth='2026-12';schedule=schedulesAll['2026-12'];const L=schedule.asg[20];const x=L.find(e=>e.id!=='" + uid(1) + "')||L[0];schedule.asg[20]=L.filter(e=>e!==x);return x.id})()");
    E("(()=>{const L=schedule.asg[21];if(!L.some(e=>e.id==='" + uid(1) + "')){L[0].id='" + uid(1) + "';}recalcSchedule();})()");
    await E("sb.from('schedules').update({data:schedule}).eq('dept_id',dept.id).eq('month','2026-12')");
    E("renderSchedule()");
    const in20 = E("schedule.asg[20].some(e=>e.id==='" + uid(1) + "')");
    ok(E("openCount().n") >= 1, `${mode}: açık nöbet görünüyor (${E("openCount().n")})`);
    E("isAdmin=()=>false");
    const h = E("openRowHTML(20,dayGroups(20).find(g=>g.si===0))");
    ok(in20 ? /zaten çalışıyor/.test(h) : /Ben tutarım/.test(h), `${mode}: 20. gün düğmesi doğru (${h.replace(/<[^>]+>/g, "").trim().slice(0, 60)})`);
    const h2 = E("openRowHTML(21,dayGroups(21).find(g=>g.si===0))");
    ok(!/Ben tutarım/.test(h2), `${mode}: 21. gün çalışan isteyemiyor / boş yer yok`);
    if (!in20) {
      await E("openClaim(20,'s0')"); await wait(500);
      const sch = () => db.schedules.find(r => r.month === "2026-12").data.asg[20].map(e => e.id);
      if (mode === "approve") {
        const pr = db.prefs.find(r => r.user_id === uid(1) && r.month === "2026-12");
        ok(pr && pr.days._claim && pr.days._claim["20|s0"] === "bek", "talep kaydedildi (onay bekliyor)");
        ok(!sch().includes(uid(1)), "onaysız listeye yazılmadı");
        E("isAdmin=()=>true"); const ha = E("openRowHTML(20,dayGroups(20).find(g=>g.si===0))"); ok(/Talip: .*KişiA — ver/.test(ha.replace(/<[^>]+>/g, "")), "yönetici talibi görüyor");
        await E(`openGive(20,'s0','${uid(1)}')`); await wait(600);
        ok(sch().includes(uid(1)), "yönetici verdi → listeye yazıldı");
      } else {
        ok(sch().includes(uid(1)), "ilk isteyen hemen listeye yazıldı");
        ok(/sana yazıldı/.test(E("__t.join('|')")), "bilgi verildi");
      }
    }
    if (errors.length) { console.log(errors.slice(0, 2)); fails.push("js6" + mode); } }
  console.log("SONUÇ:", fails.length ? fails.length + " hata: " + fails.join(" / ") : "TAMAM");
  process.exit(0);
})();
