// İstek takvimi: güne dokununca o günün vardiyaları açılır, her vardiya ayrı seçilir (ör. Gündüz istiyor, Gece istemiyor);
// kayıt, onay gerektiren işaretler, oda ekibi / tek vardiya, bütün gün ile vardiya işaretlerinin birbirini ezmemesi.
const { openApp, fixture, SH, uid } = require("../lib/harness");
const fails = []; const ok = (c, m) => { console.log((c ? "✓ " : "✗ ") + m); if (!c) fails.push(m); };
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const sh = [SH("Gündüz", "08:00", "20:00", 1), SH("Gece", "20:00", "08:00", 1)];
  const people = [{ name: "Ayla" }, { name: "Berk" }, { name: "Cem" }];
  // 1) üye gözüyle (uid(2) = Berk)
  {
    const F = fixture({ shifts: sh, people, meIdx: 1 });
    F.db.memberships.forEach(m => { m.is_admin = m.user_id === uid(1); });
    const { E, db, errors } = await openApp(F);
    E("showTab('izin')");
    ok(!E("isAdmin()") && E("editingId()") === uid(2), "üye kendi isteklerini düzenliyor");
    E("setBrush('yes')");
    ok(E("pdsWanted()"), "İstiyorum fırçasında dokunma vardiya perdesini açmalı");
    ok(E("pdsOpen(5)") && E("$('prefDaySheet').classList.contains('on')"), "5. güne dokununca perde açıldı");
    ok(E("document.querySelectorAll('#pdsBody .pds-row').length") === 3, "perdede Bütün gün + 2 vardiya");
    E("pdsSet(0,'yes')"); E("pdsSet(1,'avoid')");
    ok(E("JSON.stringify(allPrefs[editingId()]._sh[5])") === JSON.stringify({ [E("shSid(0)")]: "yes", [E("shSid(1)")]: "avoid" }), "Gündüz istiyor, Gece istemiyor kaydedildi (bellekte)");
    E("pdsSet(null,'')");
    ok(!!E("allPrefs[editingId()]._sh&&allPrefs[editingId()]._sh[5]"), "Bütün gün 'Fark etmez' vardiya işaretlerini silmiyor");
    E("pdsClose()"); await E("prefPaintSave()"); await wait(50);
    const row = db.prefs.find(p => p.user_id === uid(2));
    ok(row && row.days && row.days._sh && row.days._sh[5] && Object.keys(row.days._sh[5]).length === 2, "veritabanına yazıldı");
    ok(E("document.querySelector('#prefCal .prefday[data-d=\"5\"]').classList.contains('shmulti')"), "takvimde o gün iki işaretle görünüyor");
    E("setBrush('must')"); E("pdsOpen(7)"); E("pdsSet(1,'must')");
    ok(E("allPrefs[editingId()]._sh[7][shSid(1)]") === "must_bek", "üyenin vardiyaya özel 'kesin nöbet' isteği onaya gidiyor");
    E("pdsSet(null,'never')");
    ok(String(E("allPrefs[editingId()][7]")) === "never_bek" && !E("allPrefs[editingId()]._sh&&allPrefs[editingId()]._sh[7]"), "bütün gün işareti o günün vardiya işaretlerinin yerine geçiyor");
    E("pdsClose()");
    E("setBrush('yes')"); E("pdsOpen(12)"); E("pdsSet(null,'yes')"); E("pdsSet(1,'avoid')");
    ok(E("allPrefs[editingId()]._sh[12][shSid(0)]") === "yes" && E("allPrefs[editingId()]._sh[12][shSid(1)]") === "avoid" && !E("allPrefs[editingId()][12]"),
      "bütün gün İstiyorum iken Gece İstemiyorum seçilince Gündüz İstiyorum olarak kalıyor");
    E("pdsClose()");
    E("setBrush('izin')"); ok(!E("pdsWanted()"), "İzin fırçasında perde açılmaz (izin bütün gündür)");
    E("setBrush('yes')"); E("setPrefShift(shSid(1))"); ok(!E("pdsWanted()"), "üstte vardiya seçiliyse dokunma doğrudan o vardiyayı işaretler");
    E("setPrefShift('')");
    E("paintPref(10,false)"); ok(E("allPrefs[editingId()][10]") === "yes", "sürükleyerek boyama bütün güne işliyor");
    if (errors.length) { console.log(errors.slice(0, 3)); fails.push("js"); }
  }
  // 2) tek vardiyalı ekip: perde açılmaz
  {
    const F = fixture({ shifts: [SH("Nöbet", "08:00", "08:00", 1)], people, meIdx: 1 });
    F.db.memberships.forEach(m => { m.is_admin = false; });
    const { E } = await openApp(F);
    E("showTab('izin');setBrush('yes')");
    ok(!E("pdsOpen(5)"), "tek vardiyalı ekipte dokunma doğrudan işaretler");
  }
  // 3) oda ekibi: perde açılmaz
  {
    const F = fixture({ mode: "rooms", people, meIdx: 1 });
    F.db.memberships.forEach(m => { m.is_admin = false; });
    const { E } = await openApp(F);
    E("showTab('izin');setBrush('yes')");
    ok(!E("pdsWanted()") || !E("pdsOpen(5)"), "oda ekibinde dokunma doğrudan işaretler");
  }
  // 4) nöbet tutmayan yönetici: ekran nöbet tutan ilk kişiyle açılır, vardiya perdesi çalışır; kendi takviminde nedeni yazar
  {
    const F = fixture({ shifts: sh, people: [{ name: "Yönetici", noDuty: true }, ...people], meIdx: 0 });
    const { E, errors } = await openApp(F);
    E("showTab('izin');setBrush('yes')");
    ok(E("editingId()") === uid(2) && E("pdsOpen(5)"), "nöbet tutmayan yönetici: ilk nöbetçi seçili geliyor, güne dokununca vardiyalar açılıyor");
    E("pdsClose()"); E("$('asPerson').value=me.id;renderPrefShiftSel()");
    ok(/nöbet listesinde değilsin/.test(E("$('prefShiftSel').textContent")), "kendi takviminde neden vardiya seçimi olmadığı yazıyor");
    if (errors.length) { console.log(errors.slice(0, 3)); fails.push("js"); }
  }
  // 5) liste hazırlama sihirbazı (yönetici, "Kişilerin günleri"): güne dokununca o günün vardiyaları açılır
  {
    const F = fixture({ shifts: sh, people, meIdx: 0 });
    const { E, db, errors } = await openApp(F);
    await E("openPrepWizard()"); await wait(30);
    E("WZ.step=wzSteps().findIndex(x=>x.t==='Kişilerin günleri');WZ.d.pid=members[1].id;WZ.d.brush2='yes';wzRender()");
    ok(/vardiyaları açılır/.test(E("$('wizard').textContent")), "sihirbazda vardiya seçimi ipucu var");
    E("wzPaint(5)");
    ok(E("$('prefDaySheet').classList.contains('on')") && E("PDS&&PDS.uid") === uid(2), "sihirbazda güne dokununca o kişinin vardiya perdesi açıldı");
    E("pdsSet(0,'yes')"); E("pdsSet(1,'avoid')");
    ok(E("JSON.stringify(allPrefs[members[1].id]._sh[5])") === JSON.stringify({ [E("shSid(0)")]: "yes", [E("shSid(1)")]: "avoid" }), "Gündüz istiyor, Gece istemiyor o kişiye yazıldı");
    ok(!E("((allPrefs[me.id]||{})._sh||{})[5]"), "yöneticinin kendi isteklerine dokunulmadı");
    ok(E("!!document.querySelector('#wizard .wzcal .shmulti')"), "sihirbaz takviminde o gün iki vardiya işaretiyle görünüyor");
    E("WZ.d.brush2='must';wzRender();wzPaint(6)"); E("pdsSet(1,'must')");
    ok(E("allPrefs[members[1].id]._sh[6][shSid(1)]") === "must", "yönetici vardiyaya kesin nöbet yazabiliyor (onaysız)");
    E("pdsClose()"); await wait(700);
    const row = db.prefs.find(r => r.user_id === uid(2));
    ok(row && row.days && row.days._sh && row.days._sh[5] && row.days._sh[6], "veritabanına yazıldı");
    E("WZ.d.brush2='izin';wzRender();wzPaint(5)");
    ok(E("allPrefs[members[1].id][5]") === "izin" && !E("(allPrefs[members[1].id]._sh||{})[5]"), "izin bütün güne yazılır, vardiya işaretleri kalkar");
    E("WZ.d.brush2='';wzRender();wzPaint(6)");
    ok(!E("(allPrefs[members[1].id]._sh||{})[6]") && !E("allPrefs[members[1].id][6]"), "Sil o günün vardiya işaretlerini de siler");
    if (errors.length) { console.log(errors.slice(0, 3)); fails.push("js"); }
  }
  console.log("SONUÇ:", fails.length ? fails.length + " hata: " + fails.join(" / ") : "TAMAM"); process.exit(0);
})();
