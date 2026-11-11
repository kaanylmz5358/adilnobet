# Güvenlik: üyelerin yazdığı metinler (ad, not, ekip adı, vardiya adı, etiket, takas notu) her ekranda metin olarak görünmeli, kod olarak çalışmamalı.
# python3 ui/xss.py
import sys, os, time, json
HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.environ.get("APP", os.path.join(HERE, "..", "..", "index.html"))
from playwright.sync_api import sync_playwright
mock = open(os.path.join(HERE, "mock.js")).read()
F = json.load(open(os.path.join(HERE, "fx_shift.json")))
P = '<img src=x onerror="window.__xss=(window.__xss||[]).concat(\'{}\')">'
db = F["db"]
db["memberships"][2]["name"] = P.format("ad") + " Ayşe"
db["memberships"][3]["name"] = '"><svg onload="window.__xss=(window.__xss||[]).concat(\'ad2\')">'
db["departments"][0]["name"] = P.format("ekip")
for i, s in enumerate(db["departments"][0]["shifts"]): s["name"] = P.format("vardiya%d" % i)
o = db["departments"][0]["opts"]; pid = db["memberships"][4]["user_id"]
o.setdefault("people", {}).setdefault(pid, {})["tags"] = [P.format("etiket")]
o["rules"] = (o.get("rules") or []) + [{"id": "xx", "t": "need", "tag": P.format("kural"), "n": 1, "scope": "day", "si": -1}]
db["swap_requests"] = [{"id": 1, "dept_id": db["departments"][0]["id"], "month": "2026-12", "day": 5, "out_id": db["memberships"][2]["user_id"], "in_id": db["memberships"][3]["user_id"], "note": P.format("not"), "status": "bekliyor", "reason": P.format("neden")}]
# üyenin kendi yazabildiği alanlar: istek günleri ve takas durumu
pr = db.get("prefs") or []
pr.append({"user_id": db["memberships"][5]["user_id"], "dept_id": db["departments"][0]["id"], "month": "2026-12", "days": {"7": 'izin" onmouseover="window.__xss=(window.__xss||[]).concat(\'gun\')', "8": P.format("gun2")}})
db["prefs"] = pr
db["swap_requests"].append({"id": 2, "dept_id": db["departments"][0]["id"], "month": "2026-12", "day": 6, "out_id": db["memberships"][2]["user_id"], "in_id": db["memberships"][3]["user_id"], "note": "", "status": P.format("durum"), "reason": ""})
fxs = json.dumps(F)
SCREENS = ["showTab('bugun')", "showTab('cizelge');setSchedView('cal')", "showTab('cizelge');setSchedView('list')", "showTab('cizelge');setSchedView('mine')",
  "showTab('izin')", "showTab('leave')", "showTab('takas')", "showTab('ayarlar')"] + [f"showTab('ayarlar');setPage('{k}')" for k in
  ["ay", "ekip", "vardiya", "sayi", "kisit", "kural", "ritim", "kidem", "sabit", "aktar", "gelismis", "profil", "kapat"]] + \
  ["showTab('cizelge');generate()", "showTab('ayarlar');setPage('ekip');openPerson(members[1].id)", "showTab('ayarlar');setPage('ekip');openPerson(members[2].id)",
   "(async()=>{showTab('cizelge');await setViewMonth('2026-12');pubUI.sel=5;openDaySheet('pub')})()", "(async()=>{showTab('cizelge');await setViewMonth('2026-12');openDayEdit(5,'pub')})()"]
hits = []
with sync_playwright() as p:
    b = p.chromium.launch()
    for dev in ["phone", "desktop"]:
        ctx = b.new_context(viewport={"width": 1440, "height": 900}) if dev == "desktop" else b.new_context(**p.devices["iPhone 13"])
        pg = ctx.new_page()
        pg.add_init_script("window.__FX=" + fxs + ";")
        pg.route("**/supabase-js@2*", lambda r: r.fulfill(status=200, content_type="application/javascript", body=mock))
        pg.route("https://fonts.googleapis.com/**", lambda r: r.abort())
        pg.on("dialog", lambda d: d.accept())
        for js in SCREENS:
            pg.goto("file://" + os.path.abspath(APP)); pg.wait_for_function("typeof dept!=='undefined'&&!!dept&&members.length>0", timeout=30000); time.sleep(0.3)
            pg.evaluate("()=>{const w=document.getElementById('wizard');if(w&&w.classList.contains('is-open'))wzClose()}")
            try: pg.evaluate("()=>{" + js + "}")
            except Exception as e: print("hata", js[:40], str(e)[:120])
            time.sleep(1.2 if "generate" in js else 0.5)
            x = pg.evaluate("window.__xss||[]")
            if x: hits.append((dev, js[:60], sorted(set(x)))); print("✗", dev, js[:60], "→ çalışan kod:", sorted(set(x)))
        ctx.close()
    b.close()
print("SONUÇ [xss]:", "TAMAM" if not hits else f"{len(hits)} ekranda kod çalıştı")
