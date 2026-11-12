// "Asla" denen kural tutmayınca: "mümkün olduğunca" ve "asla bozulmasın (boş kalsın)" önerileri; önerinin listesini önizleme,
// tek tıkla uygulama, önizlemeyi kapatma; sorunlu günlerin işaretlenmesi; kural perdesinde iki seviye.
const { openApp, fixture, SH } = require("../lib/harness");
const fails = []; const ok = (c, m) => { console.log((c ? "✓ " : "✗ ") + m); if (!c) fails.push(m); };
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const sh = [SH("Gündüz", "08:00", "16:00", 1)];
  const people = [{ name: "Ayla" }, { name: "Berk" }];
  const opts = { rules: [{ id: "r1", t: "seq", who: { k: "all" }, fa: "*", fb: "*", hard: true, on: true }] };
  const prefs = { 1: { 10: "izin", 11: "izin", 12: "izin", 13: "izin" } };      // Berk 10–13 izinli → Ayla art arda çalışmak zorunda
  const F = fixture({ shifts: sh, people, opts, prefs, dept: { fill_policy: "fill_all" } });
  const { E, errors } = await openApp(F);
  E("window.__t=[];toast=(m)=>__t.push(String(m))");
  E("showTab('cizelge');generate()");
  for (let i = 0; i < 600 && E("ALT.busy"); i++) await wait(200);
  const L = E("ALT.list.map(f=>({k:f.k,t:f.title,rv:(f.res.rep||{}).ruleV,e:f.res.emptyCount||0}))");
  console.log(L.map(x => `${x.k}: ${x.t} (kural ${x.rv}, boş ${x.e})`).join("\n"));
  const base = L.find(x => x.k === "base"), keep = L.find(x => x.k === "keep");
  ok(E("(draft.rep||{}).ruleV") > 0, "taslakta 'asla' kuralı tutmuyor (beklenen)");
  ok(base && /mümkün olduğunca uygulansın/.test(base.t), "kart: “bu ay mümkün olduğunca uygulansın” " + (base ? base.t : "yok"));
  ok(keep && /asla bozulmasın/.test(keep.t) && keep.rv === 0 && keep.e > 0, "kart: “asla bozulmasın” — kural hiç bozulmuyor, o yerler boş " + (keep ? `(boş ${keep.e})` : "yok"));
  // sorunlu günler takvimde işaretli
  E("setDraftView('cal')");
  const iss = E("[...document.querySelectorAll('#draftWrap .day.iss')].length");
  ok(iss > 0, `takvimde sorunlu günler işaretli (${iss})`);
  // gün panelinde o günün sorunu ve düzenle düğmesi
  const issDay = E("(draftIssueList(draft).find(x=>x.d)||{}).d");
  const panel = E(`withView(draft,planAy(),()=>dayPanelHTML(${issDay},'draft',draftUI))`);
  ok(/Bu günde tutmayan/.test(panel) && /Bu günü düzenle/.test(panel), `gün paneli: sorun ve “Bu günü düzenle” (${issDay}. gün)`);
  // önizleme
  const ki = E("ALT.list.findIndex(f=>f.k==='keep')");
  if (ki >= 0) {
    const before = E("JSON.stringify(draft.asg)");
    E(`altPreview(${ki})`);
    ok(E("!!ALT_PV") && E("ALT_PV.chg.size") > 0, `önizleme açıldı, değişen gün ${E("ALT_PV?ALT_PV.chg.size:0")}`);
    ok(E("[...document.querySelectorAll('#draftWrap .day.chg')].length") === E("ALT_PV.chg.size"), "değişen günler takvimde çerçeveli");
    ok(/Önizleme/.test(E("$('altQuick').textContent")), "üstte önizleme bandı");
    ok(E("$('publishBtn').textContent") === "Bunu uygula" && E("$('redraftBtn').textContent") === "Önizlemeyi kapat", "alt çubuk: Önizlemeyi kapat / Bunu uygula");
    const cd = E("[...ALT_PV.chg][0]");
    ok(/Öneri bu günü değiştiriyor/.test(E(`withView(draft,planAy(),()=>dayPanelHTML(${cd},'draft',draftUI))`)), "gün panelinde şimdiki ve önerilen kişiler");
    E(`openDayEdit(${cd},'draft')`);
    ok(!E("$('dayEdit').classList.contains('on')"), "önizlemede gün düzenlenemiyor");
    await E("confirmDecide()"); await wait(200);
    ok(!E("schedulesAll[planAy()]"), "önizleme yayınlanamıyor");
    E("altPreviewEnd()");
    ok(!E("ALT_PV") && E("JSON.stringify(draft.asg)") === before, "önizlemeyi kapat: taslak aynen geri geldi");
    ok(E("$('publishBtn').textContent") === "Onayla ve yayınla", "alt çubuk eski hâline döndü");
    E(`altPreview(${ki})`); E("altPreviewApply()");
    ok(!E("ALT_PV") && E("draft.alt&&draft.alt.k") === "keep" && E("(draft.rep||{}).ruleV") === 0, "önizlemeden “Bunu uygula”: öneri uygulandı, kural tutuyor");
    E("altUndo()");
    ok(E("JSON.stringify(draft.asg)") === before, "“Önceki taslağa dön” çalışıyor");
  }
  // elle düzenleme sonrası geri bildirim
  E("__t=[]"); E(`openDayEdit(${issDay},'draft')`);
  ok(E("$('dayEdit').classList.contains('on')"), "taslakta gün düzenleyici açıldı");
  E("(()=>{const s=document.querySelector('.deSel');if(s)s.value='';})()"); await E("saveDayEdit()"); await wait(200);
  ok(/sorun|Sorun/.test(E("__t.join('|')")), "elle düzenlemeden sonra kaç sorun kaldığı söyleniyor: " + E("__t.filter(x=>/orun/.test(x)).slice(-1)[0]||__t.join(' | ')"));
  // kural perdesi: iki seviye
  const h2 = E("rbLevelHTML(rulesAll()[0])");
  ok(/Mümkün olduğunca verme/.test(h2) && /Asla verme/.test(h2), "yasak sırada iki seviye: Mümkün olduğunca verme / Asla verme");
  if (errors.length) { console.log(errors.slice(0, 3)); fails.push("js"); }
  console.log("SONUÇ:", fails.length ? fails.length + " hata: " + fails.join(" / ") : "TAMAM"); process.exit(0);
})();
