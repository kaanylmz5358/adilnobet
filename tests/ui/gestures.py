# Hareket testleri: telefonda parmak (dokunma, sürükleme, fiske, kenardan geri), bilgisayarda fare + klavye.
# python3 ui/gestures.py [phone|desktop] [--app path]
# Her biri gerçek tarayıcıda, gerçek olaylarla (dokunmatik olaylar CDP ile, fare olayları Playwright ile).
import sys, os, time, json
HERE = os.path.dirname(os.path.abspath(__file__))
args = sys.argv[1:]
DEV = args[0] if args and not args[0].startswith("--") else "phone"
APP = args[args.index("--app") + 1] if "--app" in args else os.environ.get("APP", os.path.join(HERE, "..", "..", "index.html"))
from playwright.sync_api import sync_playwright
mock = open(os.path.join(HERE, "mock.js")).read(); fxs = open(os.path.join(HERE, "fx_shift.json")).read()
fails = []; oks = 0
def ok(c, m):
    global oks
    if c: oks += 1; print("✓", m)
    else: fails.append(m); print("✗", m)

with sync_playwright() as p:
    b = p.chromium.launch()
    if DEV == "desktop": ctx = b.new_context(viewport={"width": 1440, "height": 900}, has_touch=False)
    else: ctx = b.new_context(**p.devices["iPhone 13"])
    pg = ctx.new_page()
    pg.add_init_script("window.__FX=" + fxs + ";window.__ndEdge=true;")
    pg.route("**/supabase-js@2*", lambda r: r.fulfill(status=200, content_type="application/javascript", body=mock))
    pg.route("https://fonts.googleapis.com/**", lambda r: r.abort())
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:200])); pg.on("dialog", lambda d: d.accept())
    E = lambda js: pg.evaluate(js)
    def load():
        pg.goto("file://" + os.path.abspath(APP)); pg.wait_for_function("typeof dept!=='undefined'&&!!dept&&members.length>0", timeout=30000); time.sleep(0.5)
        E("()=>{const w=document.getElementById('wizard');if(w&&w.classList.contains('is-open'))wzClose()}"); time.sleep(0.3)
    load()
    cdp = ctx.new_cdp_session(pg) if DEV != "desktop" else None
    def tdrag(x, y, dx, dy, steps=14, dt=0.016, hold=0):
        cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x, "y": y}]})
        if hold: time.sleep(hold)
        for i in range(1, steps + 1):
            cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": x + dx * i / steps, "y": y + dy * i / steps}]}); time.sleep(dt)
        cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []}); time.sleep(0.6)
    def mdrag(x, y, dx, dy, steps=12):
        pg.mouse.move(x, y); pg.mouse.down()
        for i in range(1, steps + 1): pg.mouse.move(x + dx * i / steps, y + dy * i / steps); time.sleep(0.015)
        pg.mouse.up(); time.sleep(0.5)
    sheet_on = lambda sid: E(f"()=>document.getElementById('{sid}').classList.contains('on')")

    # ---------- 1) istek takvimi: dokun / sürükle / kaydır ----------
    E("()=>{showTab('izin');setBrush('yes')}"); time.sleep(0.6)
    cnt = lambda: E("()=>Object.entries(allPrefs[me.id]||{}).filter(([d,v])=>/^\\d+$/.test(d)&&v==='yes').length")
    cells = E("""()=>{const c=[...document.querySelectorAll('#prefCal .prefday')].filter(e=>!e.classList.contains('izin')&&!e.classList.contains('never')&&!e.classList.contains('must'));
       const byRow={};c.forEach(e=>{const r=e.getBoundingClientRect();const k=Math.round(r.top);(byRow[k]=byRow[k]||[]).push({d:+e.dataset.d,x:r.left+r.width/2,y:r.top+r.height/2,w:r.width});});
       const rows=Object.values(byRow).filter(r=>r.length>=4);return rows[1]||rows[0]||null;}""")
    if not cells: ok(False, "istek takviminde boyanacak satır yok")
    else:
        pg.evaluate(f"window.scrollTo(0,{max(0, cells[0]['y'] - 300)})"); time.sleep(0.3)
        cells = E(f"""()=>{{const ds={json.dumps([c['d'] for c in cells])};return ds.map(d=>{{const e=document.querySelector('#prefCal .prefday[data-d="'+d+'"]');const r=e.getBoundingClientRect();return {{d,x:r.left+r.width/2,y:r.top+r.height/2,w:r.width}};}});}}""")
        c0 = cnt(); a, z = cells[0], cells[3]
        if DEV == "desktop":
            pg.mouse.click(a["x"], a["y"]); time.sleep(0.4)
            ok(cnt() == c0 + 1, f"fareyle tıklama bir günü işaretledi ({c0}→{cnt()})")
            pg.mouse.click(a["x"], a["y"]); time.sleep(0.4)
            ok(cnt() == c0, "aynı güne tekrar tıklama işareti kaldırdı")
            mdrag(a["x"], a["y"], z["x"] - a["x"], 0)
            ok(cnt() == c0 + 4, f"fareyle sürükleme 4 günü boyadı ({c0}→{cnt()})")
        else:
            tdrag(a["x"], a["y"], 0, 0, steps=1); time.sleep(0.3)
            ok(cnt() == c0 + 1, f"parmakla dokunma bir günü işaretledi ({c0}→{cnt()})")
            tdrag(a["x"], a["y"], 0, 0, steps=1); time.sleep(0.3)
            ok(cnt() == c0, "aynı güne tekrar dokunma işareti kaldırdı")
            tdrag(a["x"], a["y"], z["x"] - a["x"], 0, steps=16)
            ok(cnt() == c0 + 4, f"yana sürükleme 4 günü boyadı ({c0}→{cnt()})")
            c1 = cnt(); y0 = E("scrollY")
            tdrag(cells[1]["x"], cells[1]["y"] + 40, 0, -220, steps=12)
            ok(cnt() == c1, "dikey kaydırma hiçbir günü boyamadı")
            ok(E("scrollY") != y0 or E("document.documentElement.scrollHeight<=innerHeight+5"), f"dikey kaydırma sayfayı kaydırdı ({y0}→{E('scrollY')})")
            # basılı tut + aşağı sürükle → boyama (dikey de olsa)
            pg.evaluate(f"window.scrollTo(0,{y0})"); time.sleep(0.3)
            cells2 = E(f"""()=>{{const ds={json.dumps([c['d'] for c in cells])};return ds.map(d=>{{const e=document.querySelector('#prefCal .prefday[data-d="'+d+'"]');const r=e.getBoundingClientRect();return {{d,x:r.left+r.width/2,y:r.top+r.height/2}};}});}}""")
            c2 = cnt()
            q = E("""()=>{const e=[...document.querySelectorAll('#prefCal .prefday')].find(e=>!/(yes|izin|never|must|avoid)/.test(e.className)&&e.getBoundingClientRect().top>80&&e.getBoundingClientRect().bottom<innerHeight-80);if(!e)return null;const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}}""")
            tdrag(q["x"], q["y"], 0, 0, steps=1, hold=0.5)
            ok(cnt() != c2, "basılı tutunca boyama başladı")
        # temizle
        E("()=>{setBrush('');}")

    # ---------- 2) perdeler: kişi perdesi, gün perdesi ----------
    E("()=>{showTab('ayarlar');setPage('ekip');openPerson(members[2].id)}"); time.sleep(0.7)
    ok(sheet_on("personSheet"), "kişi perdesi açıldı")
    if DEV == "desktop":
        pg.keyboard.press("Escape"); time.sleep(0.5)
        ok(not sheet_on("personSheet"), "Esc kişi perdesini kapattı")
        E("()=>openPerson(members[2].id)"); time.sleep(0.6)
        r = E("()=>{const s=document.querySelector('#personSheet .sheet').getBoundingClientRect();return {t:s.top,l:s.left,r:s.right}}")
        pg.mouse.click(20, 20) if r["l"] > 40 or r["t"] > 40 else pg.mouse.click(r["r"] + 20, 450); time.sleep(0.5)
        ok(not sheet_on("personSheet"), "perdenin dışına tıklama kapattı")
        # tekerlekle kaydırma: perde içi kayar, arka sayfa kaymaz
        E("()=>openPerson(members[2].id)"); time.sleep(0.6)
        y0 = E("scrollY"); s0 = E("document.querySelector('#personSheet .sheet').scrollTop")
        bx = E("()=>{const s=document.querySelector('#personSheet .sheet').getBoundingClientRect();return [s.left+s.width/2,s.top+s.height/2]}")
        pg.mouse.move(bx[0], bx[1]); pg.mouse.wheel(0, 600); time.sleep(0.6)
        ok(E("document.querySelector('#personSheet .sheet').scrollTop") > s0 or E("(()=>{const s=document.querySelector('#personSheet .sheet');return s.scrollHeight<=s.clientHeight+2})()"), "tekerlek perde içini kaydırdı")
        ok(abs(E("scrollY") - y0) < 2, "perde açıkken arka sayfa kaymadı")
        pg.keyboard.press("Escape"); time.sleep(0.4)
    else:
        top = E("document.querySelector('#personSheet .sheet').getBoundingClientRect().top")
        tdrag(195, top + 12, 0, 60)
        ok(sheet_on("personSheet"), "az çekince perde açık kaldı")
        tdrag(195, top + 12, 0, 320)
        ok(not sheet_on("personSheet"), "aşağı çekince perde kapandı")
        E("()=>openPerson(members[2].id)"); time.sleep(0.7)
        E("document.querySelector('#personSheet .sheet').scrollTop=200"); time.sleep(0.2)
        st0 = E("document.querySelector('#personSheet .sheet').scrollTop")
        tdrag(195, 520, 0, 150)
        ok(sheet_on("personSheet") or st0 == 0, "içerik aşağıdayken çekmek perdeyi kapatmadı (önce içerik kayar)")
        E("closePerson()"); time.sleep(0.4)
        # arka sayfa kilidi
        E("()=>openPerson(members[2].id)"); time.sleep(0.6); y0 = E("scrollY")
        tdrag(195, 140, 0, -300, steps=10)
        ok(abs(E("scrollY") - y0) < 2, "perde açıkken arka sayfa parmakla kaymadı")
        E("closePerson()"); time.sleep(0.4)
    # gün perdesi (yayınlanmış takvim)
    E("async()=>{showTab('cizelge');const mk=Object.keys(schedulesAll).sort().pop();await setViewMonth(mk);setSchedView('cal');pubUI.sel=5;openDaySheet('pub')}"); time.sleep(0.8)
    ok(sheet_on("daySheet"), "gün perdesi açıldı")
    if DEV == "desktop":
        pg.keyboard.press("Escape"); time.sleep(0.5); ok(not sheet_on("daySheet"), "Esc gün perdesini kapattı")
    else:
        top = E("document.querySelector('#daySheet .sheet').getBoundingClientRect().top")
        tdrag(195, top + 12, 0, 90, steps=4, dt=0.01)
        ok(not sheet_on("daySheet"), "hızlı aşağı fiske gün perdesini kapattı")

    # ---------- 3) takvimde ay değiştirme ----------
    if E("monthsAvail().length") > 1:
        E("async()=>{showTab('cizelge');await setViewMonth(monthsAvail()[monthsAvail().length-1]);setSchedView('cal')}"); time.sleep(0.6)
        m0 = E("vMonth()")
        if DEV == "desktop":
            w = E("()=>{const r=document.getElementById('schedWrap').getBoundingClientRect();return [r.left+r.width*0.8,r.top+120,r.width]}")
            mdrag(w[0], w[1], -w[2] * 0.5, 0)
            ok(E("vMonth()") == m0, "fareyle takvimi sürüklemek ayı değiştirmedi (yanlışlıkla kayma yok)")
            nav = E("()=>{const b=[...document.querySelectorAll('#tab-cizelge .mnav')].filter(e=>e.offsetParent);if(b.length<2)return null;const r=b[0].getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]}")
            ok(bool(nav), "bilgisayarda ayın yanında önceki / sonraki okları görünüyor")
            if nav:
                pg.mouse.click(nav[0], nav[1]); time.sleep(0.8)
                m1 = E("vMonth()"); ok(m1 != m0, f"önceki ay okuna tıklama ayı değiştirdi ({m0}→{m1})")
                pg.mouse.click(5, 5); pg.keyboard.press("ArrowRight"); time.sleep(0.8)
                ok(E("vMonth()") == m0, f"→ tuşu sonraki aya geçti ({m1}→{E('vMonth()')})")
                pg.keyboard.press("ArrowLeft"); time.sleep(0.8)
                ok(E("vMonth()") == m1, "← tuşu önceki aya geçti")
            ok(E("()=>{const r=document.querySelector('.lgd-row');return !r||r.scrollWidth<=r.clientWidth+4}"), "kişi şeridi bilgisayarda alt satıra iniyor (fareyle yana kaydırma gerekmiyor)")
        else:
            w = E("()=>{const r=document.getElementById('schedWrap').getBoundingClientRect();return [r.left+r.width*0.85,Math.min(innerHeight-80,r.top+160),r.width]}")
            tdrag(w[0], w[1], -w[2] * 0.6, 0, steps=12)
            time.sleep(0.6); m1 = E("vMonth()")
            tdrag(w[0] - w[2] * 0.6, w[1], w[2] * 0.6, 0, steps=12)
            time.sleep(0.6)
            ok(m1 != m0 or E("vMonth()") != m0, f"parmakla yana kaydırma ayı değiştirdi ({m0}→{m1}→{E('vMonth()')})")

    # ---------- 4) ayarlar: geri (kenardan sürükleme / geri tuşu / klavye) ----------
    E("()=>{showTab('ayarlar');setPage('wr')}"); time.sleep(0.6)
    if DEV == "desktop":
        pg.go_back(); time.sleep(0.6)
        ok(E("$('tab-kurulum').dataset.page") == "root", "tarayıcı geri tuşu ana ayarlara döndü")
        E("()=>setPage('kural')"); time.sleep(0.5)
        vis = E("()=>{const b=document.getElementById('hdrBack');return !!b&&b.offsetParent!==null}")
        ok(vis, "alt sayfada görünür geri düğmesi var")
        if vis: E("()=>document.getElementById('hdrBack').click()"); time.sleep(0.6); ok(E("$('tab-kurulum').dataset.page") == "root", "geri düğmesi ana ayarlara döndü")
    else:
        tdrag(6, 400, 70, 0)
        ok(E("$('tab-kurulum').dataset.page") == "wr", "kısa kenar sürüklemesi sayfada bıraktı")
        tdrag(6, 400, 250, 0)
        ok(E("$('tab-kurulum').dataset.page") == "root", "uzun kenar sürüklemesi ana ayarlara döndü")
        E("()=>setPage('kural')"); time.sleep(0.5); pg.go_back(); time.sleep(0.6)
        ok(E("$('tab-kurulum').dataset.page") == "root", "telefonun geri hareketi ana ayarlara döndü")

    # ---------- 5) kural önem sırası: tutup sürükle ----------
    E("()=>{showTab('ayarlar');setPage('kural')}"); time.sleep(0.6)
    before = E("priKeys()")
    g = E("(()=>{const g=[...document.querySelectorAll('#ruleList .rl-grip')].filter(e=>e.offsetParent);if(g.length<2)return null;g[0].scrollIntoView({block:'center'});const a=g[0].getBoundingClientRect(),b=g[1].getBoundingClientRect();return {x:a.left+a.width/2,y:a.top+a.height/2,y2:b.top+b.height/2+24}})()")
    if g:
        time.sleep(0.3)
        g = E("(()=>{const g=[...document.querySelectorAll('#ruleList .rl-grip')].filter(e=>e.offsetParent);const a=g[0].getBoundingClientRect(),b=g[1].getBoundingClientRect();return {x:a.left+a.width/2,y:a.top+a.height/2,y2:b.top+b.height/2+24}})()")
        if DEV == "desktop": mdrag(g["x"], g["y"], 0, g["y2"] - g["y"], steps=16)
        else: tdrag(g["x"], g["y"], 0, g["y2"] - g["y"], steps=16)
        time.sleep(0.8)
        ok(E("priKeys()") != before, f"tutamaçla sürükleyince kural sırası değişti")
    else: ok(False, "kural sırasında tutamaç yok (en az 2 kural bekleniyordu)")

    # ---------- 6) klavye (yalnız bilgisayar): Tab ile gezinme görünür odak ----------
    if DEV == "desktop":
        load(); E("()=>showTab('bugun')"); time.sleep(0.4)
        seen = []
        for i in range(12):
            pg.keyboard.press("Tab"); time.sleep(0.05)
            seen.append(E("""()=>{const e=document.activeElement;if(!e||e===document.body)return null;const r=e.getBoundingClientRect(),cs=getComputedStyle(e);
              return {vis:r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight+400,ring:cs.outlineStyle!=='none'&&parseFloat(cs.outlineWidth)>0||cs.boxShadow!=='none'}}"""))
        f = [s for s in seen if s]
        ok(len(f) >= 6, f"Tab tuşu odağı öğeler arasında gezdiriyor ({len(f)}/12)")
        ok(all(s["vis"] for s in f), "Tab ile odaklanan her öğe görünür")
        ok(sum(1 for s in f if s["ring"]) >= len(f) * 0.6, f"odaklanan öğede görünür odak halkası var ({sum(1 for s in f if s['ring'])}/{len(f)})")

    ok(not errs, "JS hatası yok" + ("" if not errs else ": " + " | ".join(errs[:3])))
    print(f"SONUÇ [{DEV}]: {'TAMAM' if not fails else str(len(fails)) + ' hata'} ({oks} kontrol geçti)")
    b.close()
