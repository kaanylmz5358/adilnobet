/* Bağımsız denetçi: uygulamanın kodunu KULLANMAZ. Fikstürdeki ham veriden ve üretilen
   atamadan (asg) kuralları baştan hesaplar. Vardiya modu + oda modu. */
const parseDays = x => { const o = []; String(x || "").split(/[,\s]+/).filter(Boolean).forEach(t => { const m = t.match(/^(\d+)-(\d+)$/); if (m) { for (let d = +m[1]; d <= +m[2]; d++) o.push(d); } else if (/^\d+$/.test(t)) o.push(+t); }); return o; };
const hm = t => { const [h, m] = String(t || "0:0").split(":").map(Number); return h + (m || 0) / 60; };
const dur = s => { const a = hm(s.start), b = hm(s.end); return b > a ? b - a : 24 - a + b; };
const nightH = s => { let n = 0; const a = hm(s.start), L = Math.round(dur(s)); for (let t = 0; t < L; t++) { const h = (a + t) % 24; if (h >= 20 || h < 8) n++; } return n; };

function check(fx, res, o = {}) {
  const D = fx.db.departments[0], mk = D.month, [y, m] = mk.split("-").map(Number), nDays = new Date(y, m, 0).getDate();
  const shifts = D.shifts || [], mode = D.sched_mode, opts = D.opts || {}, mem = fx.db.memberships;
  const prefs = {}; fx.db.prefs.filter(r => r.month === mk).forEach(r => { prefs[r.user_id] = r.days || {}; });
  const asg = JSON.parse(JSON.stringify(res.asg || {})), out = [], info = {};
  // icap ayrı alanda saklanır: denetim için işaretli olarak aynı güne eklenir; ana listede icap işaretli kayıt OLMAMALI
  for (const d in (res.asg || {})) if ((res.asg[d] || []).some(e => e && e.ic)) out.push(`${d}. gün ana listede icap kaydı var`);
  for (const d in (res.icap || {})) (res.icap[d] || []).forEach(e => (asg[d] = asg[d] || []).push({ ...e, ic: 1 }));
  const wd = d => (new Date(y, m - 1, d).getDay() + 6) % 7;
  const pv = (id, d) => (prefs[id] || {})[d] || "";
  const ids = mem.map(p => p.user_id), byId = {}; mem.forEach(p => { byId[p.user_id] = p; });
  const name = id => (byId[id] || {}).name || id;
  const bayD0 = new Set(parseDays(D.bayram)), RL0 = (opts.rules || []).filter(r => r && r.on !== false && r.t === "staff");
  const staffOf0 = (si, d) => { const sh = shifts[si]; let c = sh.days && !sh.days[wd(d)] ? 0 : (+sh.count || 1);
    RL0.forEach(r => { if (r.si >= 0 && r.si !== si) return; let h = false; if (r.sel === "bay") h = bayD0.has(d); else if (r.sel === "wd") h = !!(r.wd || [])[wd(d)]; else h = parseDays(r.days).includes(d); if (h) c = +r.n; });
    const dn = ((opts.dneed || {})[mk] || {}), sid = sh.sid || ("i" + si); if (dn[d + "|" + sid] != null) c = +dn[d + "|" + sid];
    if (o.dneed && o.dneed[d + "|" + sid] != null) c = +o.dneed[d + "|" + sid]; return c; };
  /* o gün kişinin yazılabileceği hiçbir yer yok mu? (vardiya yok, izinli, engelli, vardiyaya katılmıyor, gece yasağı…)
     ritimde böyle günler "kişinin elinde olmayan boşluk" sayılır: blok onunla kesilirse ihlal değildir */
  const PO0 = opts.people || {};
  const canWork = (id, d) => { const v = pv(id, d); if (v === "izin" || v === "never") return false;
    const sp0 = (byId[id] || {}).shift_prefs || {};
    if (mode !== "shifts") return (D.general_rooms || 0) > 0;
    return shifts.some((sh, si) => { if (sh.icap || !(staffOf0(si, d) > 0)) return false;
      if (sh.owner && sh.owner !== id) return false; if (!sh.owner && Array.isArray(sh.only) && sh.only.length && !sh.only.includes(id)) return false;
      if (Array.isArray(sh.deny) && sh.deny.includes(id)) return false; if (sp0.allowed && sp0.allowed[si] === false) return false;
      if (sp0.noNight && nightH(sh) * 2 >= dur(sh)) return false;
      const a = hm(sh.start), z = a + dur(sh);
      for (const b of (opts.blocks || [])) { if (b.pid !== id) continue; const ds = parseDays(b.days); if (!((b.wdays || [])[wd(d)] || ds.includes(d))) continue;
        if (b.type === "block") { if (!b.start && !b.end) return false; let bs = hm(b.start), be = hm(b.end); if (be <= bs) be += 24; const ov = (x, y2) => Math.max(0, Math.min(z, y2) - Math.max(a, x)); if (ov(bs, be) > 1e-9 || ov(bs + 24, be + 24) > 1e-9 || ov(bs - 24, be - 24) > 1e-9) return false; }
        else if (b.type === "only") { let bs = hm(b.start || "00:00"), be = hm(b.end || "24:00"); if (be <= bs) be += 24; if (a < bs - 1e-9 || z > be + 1e-9) return false; } }
      return true; }); };
  // oda modu: genel oda yalnız kendi odası olmayanlara; branş odası o branşa (devredilirse genele de)
  const BR = D.branch_rooms || {}, ownRoom = pool => Object.prototype.hasOwnProperty.call(BR, pool || "");
  if (mode !== "shifts") for (let d = 1; d <= nDays; d++) (asg[d] || []).forEach(e => { if (e.ic) return; const p = byId[e.id]; if (!p) return;
    if (e.r === "G" && ownRoom(p.pool)) out.push(`${p.name} ${d}. gün kendi branş odası varken genel odada (yalnız seçilenlerin)`);
    const m0 = String(e.r || "").match(/^[BS]:(.+)$/); if (m0) { const b = m0[1], c = BR[b] || {}; if (p.pool !== b && !(c.shared && !ownRoom(p.pool))) out.push(`${p.name} ${d}. gün ${b} odasında ama bu oda yalnız seçilenlerin`); } });
  // 1) slot doluluğu
  let need = 0, filled = 0, over = 0;
  for (let d = 1; d <= nDays; d++) {
    const L = asg[d] || [];
    if (mode === "shifts") {
      shifts.forEach((sh, si) => {
        if (sh.icap) return; const c = staffOf0(si, d), got = L.filter(e => e.s === si && !e.ic).length;
        need += c; filled += Math.min(c, got); if (got > c) over += got - c;
      });
    } else { const c = D.general_rooms || 0; need += c; filled += Math.min(c, L.filter(e => e.r === "G").length);
      for (const b in (D.branch_rooms || {})) { const bc = +(D.branch_rooms[b] || {}).rooms || 0, got = L.filter(e => e.r === "B:" + b || e.r === "S:" + b).length; need += bc; filled += Math.min(bc, got); if (got > bc) over += got - bc; }
      const gG = L.filter(e => e.r === "G").length; if (gG > c) over += gG - c; }
    L.forEach(e => { if (!byId[e.id]) out.push(`gün ${d}: bilinmeyen kişi ${e.id}`); });
  }
  info.need = need; info.filled = filled; info.empty = need - filled;
  if (over) out.push(`${over} yer kapasitesinden fazla atanmış`);
  if ((D.fill_policy || "fill_all") === "fill_all" && need - filled > 0 && !o.allowEmpty) out.push(`${need - filled} boş yer (fill_all)`);
  // kişi bazlı
  const days = {}, cnt = {}, nc = {};
  ids.forEach(id => { days[id] = new Uint8Array(nDays + 2); cnt[id] = 0; nc[id] = 0; });
  const ivs = {}; ids.forEach(id => { ivs[id] = []; });
  const entry0 = (id, d) => (asg[d] || []).find(e => e.id === id && !e.ic);
  for (let d = 1; d <= nDays; d++) (asg[d] || []).forEach(e => {
    if (!byId[e.id] || e.ic) return;
    if (days[e.id][d]) out.push(`${name(e.id)} ${d}. gün iki kez`);
    days[e.id][d] = 1; cnt[e.id]++;
    if (mode === "shifts") { const sh = shifts[e.s]; const st = (d - 1) * 24 + hm(sh.start); ivs[e.id].push([st, st + dur(sh), d]); if (nightH(sh) * 2 >= dur(sh)) nc[e.id]++; }
  });
  info.cnt = cnt; info.nc = nc;
  const restH = opts.min_rest_h != null ? +opts.min_rest_h : 8;
  // oda modunda devirli adalet ya da izne oranlı pay açıkken başka ayın sayıları eskimiş sayılır (uygulama payı kendisi hesaplar)
  const qStale = ((opts.wr && opts.wr.on && opts.wr.fz) || opts.leave_prop) && opts.quota_month !== mk;
  mem.forEach(p => {
    const id = p.user_id, spf = p.shift_prefs || {};
    if (spf.noDuty && cnt[id]) out.push(`${p.name} "nöbet tutmaz" ama ${cnt[id]} nöbet almış`);
    const MS = ((opts.people || {})[id] || {}).ms;
    if (MS && MS.on && (MS.d || []).some(Boolean)) {
      if (cnt[id]) out.push(`${p.name} sabit mesaide ama ${cnt[id]} nöbet almış`);
      if (o.mesai !== false && res.mesai !== undefined) { const bay = new Set(parseDays(D.bayram));
        for (let d = 1; d <= nDays; d++) { const t = MS.d[wd(d)], v = pv(id, d), want = !!(t && !(bay.has(d) && !MS.hol) && v !== "izin" && v !== "never");
          const got = ((res.mesai || {})[d] || []).find(e => e.id === id);
          if (want && !got) out.push(`${p.name} ${d}. gün mesai yazılmamış`);
          if (!want && got && !o.mesaiManual) out.push(`${p.name} ${d}. gün mesai olmamalı`);
          if (want && got && (got.a !== t[0] || got.b !== t[1]) && !o.mesaiManual) out.push(`${p.name} ${d}. gün mesai saati ${got.a}-${got.b} (beklenen ${t[0]}-${t[1]})`); } } }
    if (mode === "shifts") for (let d = 1; d <= nDays; d++) (asg[d] || []).forEach(e => { if (e.id !== id || e.ic) return; const sh = shifts[e.s] || {};
      if (sh.owner && sh.owner !== id) out.push(`${p.name} ${d}. gün başkasına özel vardiyada`);
      if (!sh.owner && Array.isArray(sh.only) && sh.only.length && !sh.only.includes(id)) out.push(`${p.name} ${d}. gün yalnız seçilenlerin vardiyasında`);
      if (Array.isArray(sh.deny) && sh.deny.includes(id)) out.push(`${p.name} ${d}. gün katılmadığı vardiyada`);
      if (spf.allowed && spf.allowed[e.s] === false) out.push(`${p.name} ${d}. gün kişi kartında kapalı vardiyada`); });
    const SHP = (prefs[id] || {})._sh || {};
    if (mode === "shifts") for (const d in SHP) for (const sid in SHP[d]) { const si = shifts.findIndex((x, i) => (x.sid || ("i" + i)) === sid); if (si < 0) continue;
      const v = SHP[d][sid], e = entry0(id, +d);
      if (v === "never" && e && e.s === si) out.push(`${p.name} ${d}. gün ${shifts[si].start} vardiyası "yok" ama atanmış`);
      if (v === "must" && !(e && e.s === si) && !spf.noDuty && !(MS && MS.on) && !o.mustSoft) out.push(`${p.name} ${d}. gün ${shifts[si].start} vardiyası "kesin" ama ${e ? "başka vardiyada" : "atanmamış"}`); }
    for (let d = 1; d <= nDays; d++) {
      const v = pv(id, d);
      if (days[id][d] && (v === "izin" || v === "never")) out.push(`${p.name} ${d}. gün ${v === "izin" ? "izinli" : "nöbet yok"} ama atanmış`);
      if (v === "must" && !days[id][d] && !spf.noDuty && !(MS && MS.on) && !o.mustSoft) out.push(`${p.name} ${d}. gün kesin nöbet ama atanmamış`);
    }
    if (mode === "shifts") {
      const iv = ivs[id].sort((a, b) => a[0] - b[0]);
      for (let i = 1; i < iv.length; i++) {
        if (iv[i][0] < iv[i - 1][1] - 1e-9) out.push(`${p.name} ${iv[i][2]}. gün çakışan vardiya`);
        else if (restH > 0 && iv[i][0] < iv[i - 1][1] + restH - 1e-9) out.push(`${p.name} ${iv[i][2]}. gün ${restH} saat dinlenme yok`);
      }
    }
    { const tg = qStale ? 0 : mode === "shifts" ? +spf.target || 0 : Object.prototype.hasOwnProperty.call(D.branch_rooms || {}, p.pool || "") ? 0 : +p.quota || 0; if (o.targets && tg > 0 && !spf.noDuty && !(MS && MS.on) && cnt[id] !== tg) out.push(`${p.name}: ${tg} nöbet istendi, ${cnt[id]} verildi`); }
    if (o.nights && spf.nightTarget != null && spf.nExact && !spf.noDuty && nc[id] !== spf.nightTarget) out.push(`${p.name}: ${spf.nightTarget} gece istendi, ${nc[id]} verildi`);
  });
  // oda modu: iki nöbet arası en az (min_gap; 2 = bir gün boşluk), ritim yoksa
  if (mode !== "shifts" && !(+D.pattern_on > 0) && !(opts.rhythm && opts.rhythm.on)) { const g = Math.max(0, (+D.min_gap || 1) - 1);
    if (g > 0) mem.forEach(p => { const id = p.user_id; let last = -99; for (let d = 1; d <= nDays; d++) if (days[id][d]) { if (d - last <= g) out.push(`${p.name} ${d}. gün iki nöbet arası ${d - last} gün (en az ${g + 1})`); last = d; } }); }
  // saat/gün engelleri (block: o saatlerde çalışamaz · only: yalnız bu saatlerde)
  if (mode === "shifts") (opts.blocks || []).forEach(b => { const id = b.pid; if (!byId[id]) return;
    const dset = String(b.days || "").split(",").map(x => x.trim()).filter(Boolean).map(Number);
    const hits = d => (b.wdays || [])[wd(d)] || dset.includes(d);
    for (let d = 1; d <= nDays; d++) { const e = entry0(id, d); if (!e || !hits(d)) continue; const sh = shifts[e.s]; const a = hm(sh.start), z = a + dur(sh);
      if (b.type === "block") { if (!b.start && !b.end) { out.push(`${name(id)} ${d}. gün engelli günde nöbet`); continue; }
        let bs = hm(b.start), be = hm(b.end); if (be <= bs) be += 24; const ov = (x, y) => Math.max(0, Math.min(z, y) - Math.max(a, x));
        if (ov(bs, be) > 1e-9 || ov(bs + 24, be + 24) > 1e-9 || ov(bs - 24, be - 24) > 1e-9) out.push(`${name(id)} ${d}. gün engelli saatte (${b.start}–${b.end})`); }
      else if (b.type === "only") { let bs = hm(b.start || "00:00"), be = hm(b.end || "24:00"); if (be <= bs) be += 24; if (a < bs - 1e-9 || z > be + 1e-9) out.push(`${name(id)} ${d}. gün izinli saat dışında (${b.start}–${b.end})`); } } });
  // ritim
  const R = opts.rhythm && opts.rhythm.on ? opts.rhythm : null;
  const fixedOn = +D.pattern_on || 0, fixedOff = +D.pattern_off || 0;
  let rV = 0; const rDet = [];
  mem.forEach(p => {
    const id = p.user_id; if ((p.shift_prefs || {}).noDuty || !cnt[id]) return;
    const free = d => !canWork(id, d);
    const on = d => !!days[id][d];
    // blok listesi
    let d = 1; const blocks = [];
    while (d <= nDays) { let e = d; while (e < nDays && on(e + 1) === on(d)) e++; blocks.push([on(d), d, e]); d = e + 1; }
    blocks.forEach(([w, a, b], k) => {
      const len = b - a + 1, edge = a === 1 || b === nDays;
      if (R) {
        if (w) { if (len > R.wMax) { rV++; rDet.push(`${p.name} ${a}-${b} ${len} gün art arda (en çok ${R.wMax})`); }
          else if (len < R.wMin && !edge) { // izin günleriyle kesilmişse sayılmaz
            const cut = (a > 1 && free(a - 1)) || (b < nDays && free(b + 1)); if (!cut) { rV++; rDet.push(`${p.name} ${a}-${b} ${len} gün çalışma (en az ${R.wMin})`); } } }
        else {
          if (!edge && len < R.oMin) { rV++; rDet.push(`${p.name} ${a}-${b} ${len} gün dinlenme (en az ${R.oMin})`); }
          if (R.oMax > 0 && len > R.oMax) { let hasFree = false; for (let x = a; x <= b; x++) if (free(x)) hasFree = true;
            if (!hasFree && !(a === 1 && o.lenientStart)) { rV++; rDet.push(`${p.name} ${a}-${b} ${len} gün boşluk (en çok ${R.oMax})`); } }
        }
      } else if (fixedOn > 0) {
        if (w) { if (len > fixedOn) { rV++; rDet.push(`${p.name} ${a}-${b} ${len} gün (sabit ${fixedOn})`); }
          else if (len < fixedOn && !edge) { const cut = (a > 1 && free(a - 1)) || (b < nDays && free(b + 1)); if (!cut) { rV++; rDet.push(`${p.name} ${a}-${b} ${len} gün (sabit ${fixedOn})`); } } }
        else if (!edge && len < fixedOff) { rV++; rDet.push(`${p.name} ${a}-${b} ${len} gün dinlenme (sabit ${fixedOff})`); }
      }
    });
  });
  info.rhythmV = rV; info.rhythmDet = rDet;
  if (rV && !o.allowRhythm) out.push(`ritim ${rV} yerde bozuk: ${rDet.slice(0, 4).join("; ")}`);
  // kıdem
  const S0 = opts.sen && opts.sen.on ? opts.sen : null, PO = opts.people || {};
  const S = S0 && S0.mode !== "guard" ? S0 : null;
  if (S0 && S0.mode === "guard" && mode === "shifts") {
    const th = S0.th != null && S0.th !== "" ? +S0.th : 3, tier = id => { const v = (PO[id] || {}).sv; return v == null || v === "" ? null : (+v >= th ? "hi" : "lo"); };
    let gv = 0; const ivOf = (e, d) => { const sh = shifts[e.s]; const a = (d - 1) * 24 + hm(sh.start); return [a, a + dur(sh)]; };
    if (S0.scope === "time") {
      for (let d = 1; d <= nDays; d++) (asg[d] || []).forEach(e => { if (e.ic || tier(e.id) !== "lo") return; const iv = ivOf(e, d);
        const H = []; for (let dd = d - 1; dd <= d + 1; dd++) (asg[dd] || []).forEach(x => { if (!x.ic && tier(x.id) === "hi") H.push(ivOf(x, dd)); });
        H.sort((a, b) => a[0] - b[0]); let cur = iv[0]; for (const x of H) { if (x[1] <= cur) continue; if (x[0] > cur) break; cur = x[1]; }
        if (cur < iv[1]) { gv++; if (!o.allowSen) out.push(`${name(e.id)} ${d}. gün alt kıdem, yanında üst kıdemsiz saat var`); } });
    } else { const grp = {}; for (let d = 1; d <= nDays; d++) (asg[d] || []).forEach(e => { if (e.ic) return; const k = S0.scope === "day" ? "" + d : d + "|" + e.s; const g = grp[k] || (grp[k] = { hi: 0, lo: 0 }); const t = tier(e.id); if (t === "hi") g.hi++; else if (t === "lo") g.lo++; });
      for (const k in grp) { const g = grp[k]; if (g.lo > 0 && g.hi < Math.max(1, +S0.hiMin || 0)) { gv++; if (!o.allowSen) out.push(`${k}: alt kıdem var, üst kıdem yok`); } } }
    info.senV = gv;
  }
  if (S && (S.hiMin > 0 || S.loMin > 0) && mode === "shifts" && mem.some(p => !(p.shift_prefs || {}).noDuty && (PO[p.user_id] || {}).sv != null && (PO[p.user_id] || {}).sv !== "")) {
    const th = S.th != null && S.th !== "" ? +S.th : 3; let sv = 0;
    const grp = {};
    for (let d = 1; d <= nDays; d++) (asg[d] || []).forEach(e => { if (e.ic) return; const k = S.scope === "day" ? "" + d : d + "|" + e.s; const g = grp[k] || (grp[k] = { hi: 0, lo: 0 });
      const v = (PO[e.id] || {}).sv; if (v == null || v === "") return; if (+v >= th) g.hi++; else g.lo++; });
    for (const k in grp) { const g = grp[k]; sv += Math.max(0, (+S.hiMin || 0) - g.hi) + Math.max(0, (+S.loMin || 0) - g.lo); }
    info.senV = sv; if (sv && !o.allowSen) out.push(`kıdem kuralı ${sv} yerde tutmadı`);
  }
  // cinsiyet karışımı (mix): 2+ kişilik her nöbette en az 1 kadın + 1 erkek
  const G = opts.gen && opts.gen.mode === "mix" ? opts.gen : null;
  if (G) { let K = 0, Ee = 0; mem.forEach(p => { if ((p.shift_prefs || {}).noDuty) return; const g = (PO[p.user_id] || {}).g; if (g === "k") K++; else if (g === "e") Ee++; });
    if (K && Ee) { const grp = {}; let gv = 0;
      for (let d = 1; d <= nDays; d++) (asg[d] || []).forEach(e => { if (e.ic) return; const k = (G.scope === "day" || mode !== "shifts") ? "" + d : d + "|" + e.s; const g = grp[k] || (grp[k] = { n: 0, k: 0, e: 0 }); g.n++; const x = (PO[e.id] || {}).g; if (x === "k") g.k++; else if (x === "e") g.e++; });
      for (const k in grp) { const g = grp[k]; if (g.n >= 2) gv += (g.k ? 0 : 1) + (g.e ? 0 : 1); }
      info.genV = gv; if (gv && !o.allowGen) out.push(`kadın–erkek karışımı ${gv} yerde yok`); } }
  // ---- yeni kurallar (uygulama kodu kullanılmadan) ----
  const RL = (opts.rules || []).filter(r => r && r.on !== false);
  const tagsOf = id => ((PO[id] || {}).tags) || [];
  const onDutyP = p => { if ((p.shift_prefs || {}).noDuty) return false; const ms = (PO[p.user_id] || {}).ms; return !(ms && ms.on && (ms.d || []).some(Boolean)); };
  const whoHas = (w, p) => !w || w.k === "all" ? true : w.k === "p" ? (w.ids || []).includes(p.user_id) : w.k === "tag" ? tagsOf(p.user_id).includes(w.tag) : false;
  const isLeave = (id, d) => { const v = pv(id, d); return v === "izin" || v === "never"; };
  const entry = (id, d) => (asg[d] || []).find(e => e.id === id && !e.ic);
  const isN = e => { const sh = shifts[e.s]; return nightH(sh) * 2 >= dur(sh); };
  const val = (id, d, what, si, lh) => { const e = entry(id, d); if (!e) return 0; if (what === "night") return isN(e) ? 1 : 0; if (what === "hours") { const sh = shifts[e.s], D0 = dur(sh); return D0 - Math.max(0, Math.min(D0, (+sh.brk || 0) / 60)); } if (what === "shift") return e.s === si ? 1 : 0; if (what === "long") return dur(shifts[e.s]) > (+lh || 10) ? 1 : 0; return 1; };
  // nöbet sonrası izin (izin ve sıra kuralları açıksa): o hafta gününün izin sayısı kadar gün nöbet yazılmaz (KATI)
  if (opts.wr && opts.wr.on && Array.isArray(opts.wr.off)) for (const p of mem) { const id = p.user_id; if (p.works_after) continue;
    for (let d = 1; d <= nDays; d++) if (entry(id, d)) { const k = +opts.wr.off[wd(d)] || 0; for (let j = 1; j <= k && d + j <= nDays; j++) if (entry(id, d + j)) out.push(`${name(id)} ${d + j}. gün: ${d}. gündeki nöbetin sonrası izinde nöbet (KATI)`); } }
  let ruleV = 0; const rp = [];
  const bad = (txt, u = 1) => { ruleV += u; rp.push(txt); };
  // tarihe özel kişi sayısı
  const bayD = new Set(parseDays(D.bayram));
  const staffOf = (si, d) => { const sh = shifts[si]; let c = sh.days && !sh.days[wd(d)] ? 0 : (+sh.count || 1);
    RL.filter(r => r.t === "staff").forEach(r => { if (r.si >= 0 && r.si !== si) return; let h = false; if (r.sel === "bay") h = bayD.has(d); else if (r.sel === "wd") h = !!(r.wd || [])[wd(d)]; else h = parseDays(r.days).includes(d); if (h) c = +r.n; });
    const dn = ((opts.dneed || {})[mk] || {}), sid = sh.sid || ("i" + si); if (dn[d + "|" + sid] != null) c = +dn[d + "|" + sid];
    if (o.dneed && o.dneed[d + "|" + sid] != null) c = +o.dneed[d + "|" + sid]; return c; };
  if (mode === "shifts" && RL.some(r => r.t === "staff")) { let sd = 0; for (let d = 1; d <= nDays; d++) shifts.forEach((sh, si) => { if (sh.icap) return; const got = (asg[d] || []).filter(e => e.s === si && !e.ic).length; if (got > staffOf(si, d)) sd += got - staffOf(si, d); }); if (sd) out.push(`tarihe özel kişi sayısı ${sd} yerde aşıldı`); }
  for (const r of RL) {
    const P = mem.filter(p => onDutyP(p) && whoHas(r.who, p));
    // ---- yeni biçimler: kayan pencere, boş gün, art arda/kayan hafta sonu, yasak sıra ----
    if (r.t === "seq") { const M = (sp, e) => !!e && (sp === "*" || (sp === "N" ? isN(e) : sp === "D" ? !isN(e) : e.s === +sp));
      for (const p of P) for (let d = 2; d <= nDays; d++) if (M(String(r.fb), entry(p.user_id, d)) && M(String(r.fa), entry(p.user_id, d - 1))) bad(`${name(p.user_id)} ${d}. gün yasak sıra ${r.fa}→${r.fb}`);
      continue; }
    if (r.t === "lim" && (r.what === "off" || r.per === "roll" || (r.what === "weekend" && r.per !== "month"))) {
      const n = +r.n, mx = r.op !== "min", W = +r.win || (r.what === "weekend" ? 2 : 7);
      for (const p of P) { const id = p.user_id, off = d => !entry(id, d), lv = d => isLeave(id, d);
        if (r.what === "weekend") { if (!mx) continue; const L = []; for (let d = 1; d <= nDays; d++) { if (wd(d) === 5) L.push(!!(entry(id, d) || entry(id, d + 1))); else if (d === 1 && wd(1) === 6) L.push(!!entry(id, 1)); }
          if (r.per === "row") { let run = 0; for (const x of L) { run = x ? run + 1 : 0; if (run > n) bad(`${name(id)} art arda ${run} hafta sonu > ${n}`); } }
          else for (let j = 0; j < L.length; j++) { let k = 0; for (let i = Math.max(0, j - W + 1); i <= j; i++) if (L[i]) k++; if (L[j] && k > n) bad(`${name(id)} ${W} hafta sonunda ${k} > ${n}`); }
          continue; }
        if (r.what === "off") {
          if (r.per === "month") { let t = 0; for (let d = 1; d <= nDays; d++) if (off(d) && !(mx && lv(d))) t++; if (mx ? t > n : t < n) bad(`${name(id)} ayda ${t} boş gün (${r.op} ${n})`); }
          else if (r.per === "week") { for (let a = 1 - wd(1); a <= nDays; a += 7) { if (a < 1 || a + 6 > nDays) continue; let t = 0; for (let d = a; d < a + 7; d++) if (off(d) && !(mx && lv(d))) t++; if (mx ? t > n : t < n) bad(`${name(id)} ${a}. haftada ${t} boş gün (${r.op} ${n})`); } }
          else if (r.per === "row") { for (let d = 1; d <= nDays; d++) { if (!off(d)) continue; let b = d; while (b < nDays && off(b + 1)) b++; let hz = false; for (let x = d; x <= b; x++) if (lv(x)) hz = true; const len = b - d + 1;
              if (!mx && d > 1 && b < nDays && !hz && len < n) bad(`${name(id)} ${d}. gün ${len} gün boş < ${n}`); if (mx && !hz && len > n) bad(`${name(id)} ${d}. günden ${len} gün boş > ${n}`); d = b; } }
          else { for (let a = 1; a + W - 1 <= nDays; a++) { let t = 0, tc = 0; for (let d = a; d < a + W; d++) { if (off(d)) t++; if (off(d) && !lv(d)) tc++; } if (!mx && t < n) { bad(`${name(id)} ${a}–${a + W - 1} ${t} boş gün < ${n}`); } if (mx && tc > n) bad(`${name(id)} ${a}–${a + W - 1} ${tc} boş gün > ${n}`); } }
          continue; }
        // kayan pencere: nöbet / gece / saat / vardiya
        for (let a = 1; a + W - 1 <= nDays; a++) { let t = 0, hz = false; for (let d = a; d < a + W; d++) { t += val(id, d, r.what, r.si, r.lh); if (lv(d)) hz = true; }
          if (mx && t > n) bad(`${name(id)} ${a}–${a + W - 1}: ${t} > ${n} ${r.what}`); if (!mx && !hz && t < n) bad(`${name(id)} ${a}–${a + W - 1}: ${t} < ${n} ${r.what}`); } }
      continue; }
    if (r.t === "lim") for (const p of P) { const id = p.user_id;
      if (r.what === "weekend") { let k = 0; for (let d = 1; d <= nDays; d++) { if (wd(d) === 5 && (entry(id, d) || entry(id, d + 1))) k++; else if (d === 1 && wd(1) === 6 && entry(id, 1)) k++; }
        if (r.op === "max" && k > r.n) bad(`${name(id)} ${k} hafta sonu > ${r.n}`); if (r.op === "min" && k < r.n) bad(`${name(id)} ${k} hafta sonu < ${r.n}`); continue; }
      if (r.per === "month") { let t = 0; for (let d = 1; d <= nDays; d++) t += val(id, d, r.what, r.si, r.lh); if (r.op === "max" && t > r.n) bad(`${name(id)} ayda ${t} > ${r.n} ${r.what}`); if (r.op === "min" && t < r.n) bad(`${name(id)} ayda ${t} < ${r.n} ${r.what}`); }
      else if (r.per === "week") { const W = {}, F = {}; for (let d = 1; d <= nDays; d++) { const k = Math.floor((d - 1 + wd(1)) / 7); W[k] = (W[k] || 0) + val(id, d, r.what, r.si, r.lh); F[k] = (F[k] || 0) + 1; }
        for (const k in W) { if (r.op === "max" && W[k] > r.n) bad(`${name(id)} hafta ${k}: ${W[k]} > ${r.n} ${r.what}`); if (r.op === "min" && F[k] === 7 && W[k] < r.n) bad(`${name(id)} hafta ${k}: ${W[k]} < ${r.n}`); } }
      else { let run = 0; for (let d = 1; d <= nDays + 1; d++) { const on = d <= nDays && val(id, d, r.what, r.si, r.lh) > 0; if (on) run++; else { if (r.op === "max" && run > r.n) bad(`${name(id)} art arda ${run} > ${r.n} ${r.what}`); run = 0; } } } }
    if (r.t === "after") for (const p of P) { const id = p.user_id, K = Math.max(1, +r.k || 1);
      for (let d = 1; d <= nDays; d++) if (val(id, d, r.what, r.si, r.lh) > 0 && !(d < nDays && val(id, d + 1, r.what, r.si, r.lh) > 0)) {
        let L = 0; for (let x = d; x >= 1 && val(id, x, r.what, r.si, r.lh) > 0; x--) L++; if (L < K) continue;
        for (let k = 1; k <= r.n && d + k <= nDays; k++) if (entry(id, d + k)) bad(`${name(id)} ${d + k}. gün ${r.what} sonrası izinde çalışıyor`); } }
    if (r.t === "wkfull" && r.mode === "split") for (const p of P) { const id = p.user_id; for (let d = 1; d < nDays; d++) if (wd(d) === 5 && entry(id, d) && entry(id, d + 1)) bad(`${name(id)} ${d}. hafta sonunun iki gününde de`); }
    if (r.t === "wkfull" && r.mode === "type") for (const p of P) { const id = p.user_id; for (let d = 1; d < nDays; d++) if (wd(d) === 5) { const a = entry(id, d), b = entry(id, d + 1); if (a && b && a.s !== b.s) bad(`${name(id)} ${d}. hafta sonu iki ayrı vardiya`); } }
    if (r.t === "wkfull" && r.mode !== "split" && r.mode !== "type") for (const p of P) { const id = p.user_id; for (let d = 1; d < nDays; d++) if (wd(d) === 5) { const a = !!entry(id, d), b = !!entry(id, d + 1); if (a !== b && !isLeave(id, d) && !isLeave(id, d + 1)) bad(`${name(id)} ${d}. hafta sonu bölünmüş`); } }
    if (r.t === "need") { const g = {}; for (let d = 1; d <= nDays; d++) (asg[d] || []).forEach(e => { if (e.ic) return; if (r.si >= 0 && e.s !== r.si) return; const k = r.scope === "day" ? "" + d : d + "|" + e.s; const x = g[k] || (g[k] = { n: 0, t: 0 }); x.n++; if (tagsOf(e.id).includes(r.tag)) x.t++; });
      for (const k in g) if (g[k].t < Math.min(r.n, g[k].n)) bad(`${k}: ${g[k].t} ${r.tag} < ${r.n}`); }
    if (r.t === "only") for (let d = 1; d <= nDays; d++) (asg[d] || []).forEach(e => { if (e.s === r.si && !tagsOf(e.id).includes(r.tag)) out.push(`${name(e.id)} ${d}. gün ${r.tag} gerektiren vardiyada (KATI KURAL)`); });
    if (r.t === "pair") for (let d = 1; d <= nDays; d++) { const a = !!entry(r.a, d), b = !!entry(r.b, d);
      if (r.mode === "never" && a && b) bad(`${d}. gün ${name(r.a)}+${name(r.b)} birlikte`); if (r.mode === "same" && a !== b && !isLeave(a ? r.b : r.a, d)) bad(`${d}. gün ${name(r.a)}/${name(r.b)} ayrı`); }
    if (r.t === "eq") { const k = {}; P.forEach(p => { k[p.user_id] = 0; }); for (let d = 1; d <= nDays; d++) (asg[d] || []).forEach(e => { if (!e.ic && e.s === +r.si && k[e.id] != null) k[e.id]++; });
      const free = P.filter(p => { const sh = shifts[+r.si] || {}; if (Array.isArray(sh.deny) && sh.deny.includes(p.user_id)) return false;
        const spf = p.shift_prefs || {}; if (spf.noNight && nightH(sh) * 2 >= dur(sh)) return false; if (spf.allowed && spf.allowed[+r.si] === false) return false;
        if (sh.owner && sh.owner !== p.user_id) return false; if (!sh.owner && Array.isArray(sh.only) && sh.only.length && !sh.only.includes(p.user_id)) return false; for (let d = 1; d <= nDays; d++) { const v = pv(p.user_id, d); if (v === "izin" || v === "never") return false; } return !(opts.blocks || []).some(b => b.pid === p.user_id); });
      const vs = free.map(p => k[p.user_id]); info.eq = info.eq || {}; info.eq[r.si] = k;
      if (vs.length > 1 && Math.max(...vs) - Math.min(...vs) > 1) bad(`eşit dağıt: ${shifts[+r.si].start} vardiyası ${Math.min(...vs)}–${Math.max(...vs)}`, Math.max(...vs) - Math.min(...vs) - 1); }
    if (r.t === "cycle") { const pat = String(r.pat || "").toUpperCase(), L = pat.length; if (L < 2) continue;
      // ekip döngüsü: başlangıç tarihi verilmişse kaydırma sabittir (o tarihte döngünün 1. günü)
      let fixO = null; if (/^\d{4}-\d{2}-\d{2}$/.test(String(r.start || ""))) { const st = r.start, df = Math.round((Date.UTC(y, m - 1, 1) - Date.UTC(+st.slice(0, 4), +st.slice(5, 7) - 1, +st.slice(8, 10))) / 864e5); fixO = ((df % L) + L) % L; }
      for (const p of P) { const id = p.user_id; let best = 1e9;
        for (let o = 0; o < L; o++) { if (fixO != null && o !== fixO) continue; let mm = 0; for (let d = 1; d <= nDays; d++) { if (isLeave(id, d)) continue; const c = pat[(d - 1 + o) % L], e = entry(id, d);
            if (c === "-") { if (e) mm++; } else if (!e) mm++; else if (c === "G" && isN(e)) mm++; else if (c === "N" && !isN(e)) mm++; else if (/[1-9]/.test(c) && e.s !== +c - 1) mm++; }
          best = Math.min(best, mm); }
        if (best) bad(`${name(id)} döngüden ${best} gün sapıyor`, best); } }
  }
  info.ruleV = ruleV; info.ruleDet = rp;
  if (ruleV && !o.allowRules) out.push(`kurallar ${ruleV} yerde tutmadı: ${rp.slice(0, 3).join("; ")}`);
  // icap: aynı gün nöbet yok, geceden çıkan icap olmaz, sayılar dengeli
  if (shifts.some(sh => sh.icap)) { const ic = {}; for (let d = 1; d <= nDays; d++) (asg[d] || []).forEach(e => { if (!e.ic) return; ic[e.id] = (ic[e.id] || 0) + 1;
      if (entry(e.id, d)) out.push(`${name(e.id)} ${d}. gün hem nöbette hem icapta`); const pe = entry(e.id, d - 1); if (pe && dur(shifts[pe.s]) + hm(shifts[pe.s].start) > 24) out.push(`${name(e.id)} ${d}. gün geceden çıkıp icapta`); });
    const vals = mem.filter(p => onDutyP(p) && !(+((PO[p.user_id] || {}).ratio) > 0 && +((PO[p.user_id] || {}).ratio) < 100)).map(p => ic[p.user_id] || 0);
    info.icap = ic; if (vals.length && Math.max(...vals) - Math.min(...vals) > 1) out.push(`icap sayıları dengesiz: ${Math.min(...vals)}–${Math.max(...vals)}`); }
  return { ok: out.length === 0, problems: out, info };
}
module.exports = { check };
