# Arayüz denetimi: her ekran, her düğme — telefon (dokunmatik) ve fareli bilgisayar ayrı ayrı.
# python3 ui/crawl.py [phone|desktop|tablet|android|small] [fx_shift.json] [--monkey N] [--app path]
# Denetlenenler: yatay taşma, ekran dışına taşan öğe, başka öğenin altında kalan (basılamayan) düğme,
# küçük dokunma hedefi (telefon), fare imleci (bilgisayar), Esc ile perde kapanması (bilgisayar),
# perde açıkken arka sayfanın kaymaması, her tıklamada JS hatası. Rastgele "maymun" tıklamaları da var.
import sys, os, time, json, random
HERE = os.path.dirname(os.path.abspath(__file__))
args = sys.argv[1:]
DEV = args[0] if args else "phone"
FX = args[1] if len(args) > 1 and not args[1].startswith("--") else "fx_shift.json"
MONKEY = int(args[args.index("--monkey") + 1]) if "--monkey" in args else 0
APP = args[args.index("--app") + 1] if "--app" in args else os.environ.get("APP", os.path.join(HERE, "..", "..", "index.html"))
OUT = os.path.join(HERE, "..", "out", "ui_" + DEV); os.makedirs(OUT, exist_ok=True)
from playwright.sync_api import sync_playwright
mock = open(os.path.join(HERE, "mock.js")).read(); fxs = open(os.path.join(HERE, FX)).read()
fails, warns = [], []
def F(m): fails.append(m); print("✗", m)
def W(m): warns.append(m)
SKIP = r"/(çıkış|oturumu kapat|ekipten ayrıl|ayrıl|hesabı sil|ekibi sil|listeyi sil|takımı sil|bu ayı sil)/i"
SCREENS = [("bugun", "showTab('bugun')"), ("takvim", "showTab('cizelge')"), ("takvim-liste", "showTab('cizelge');setSchedView('list')"),
  ("takvim-benim", "showTab('cizelge');setSchedView('mine')"), ("istek-izin", "showTab('izin')"), ("istek-leave", "showTab('leave')"), ("istek-takas", "showTab('takas')"),
  ("ayarlar", "showTab('ayarlar')")] + [("ayar-" + k, f"showTab('ayarlar');setPage('{k}')") for k in
  ["ay", "ekip", "vardiya", "oda", "sayi", "kisit", "kural", "ritim", "kidem", "sabit", "wr", "aktar", "gelismis", "profil", "kapat"]] + \
  [("taslak", "showTab('cizelge');generate()")]
with sync_playwright() as p:
    b = p.chromium.launch()
    if DEV == "desktop": ctx = b.new_context(viewport={"width": 1440, "height": 900}, has_touch=False)
    elif DEV == "tablet": ctx = b.new_context(**p.devices["iPad Pro 11"])
    elif DEV == "android": ctx = b.new_context(**p.devices["Pixel 7"])
    elif DEV == "small": ctx = b.new_context(**p.devices["iPhone SE"])     # 320 px: en dar telefon
    else: ctx = b.new_context(**p.devices["iPhone 13"])
    pg = ctx.new_page()
    pg.add_init_script("window.__FX=" + fxs + ";")
    pg.route("**/supabase-js@2*", lambda r: r.fulfill(status=200, content_type="application/javascript", body=mock))
    pg.route("https://fonts.googleapis.com/**", lambda r: r.abort())
    errs = []
    pg.on("pageerror", lambda e: errs.append("PAGE: " + str(e)[:300]))
    # ağ hataları (ör. yapay zekâ sorusu dış sunucuya gidemez) uygulama hatası sayılmaz; uygulama bunu kendi mesajıyla gösterir
    pg.route("https://api.anthropic.com/**", lambda r: r.abort())
    pg.on("console", lambda m: errs.append("CONSOLE: " + m.text[:300]) if m.type == "error" and "Failed to load resource" not in m.text else None)
    pg.on("dialog", lambda d: d.accept())
    def load():
        pg.goto("file://" + os.path.abspath(APP)); pg.wait_for_function("typeof dept!=='undefined'&&!!dept&&members.length>0", timeout=30000); time.sleep(0.6)
    E = lambda js: pg.evaluate(js)
    load()
    # yardımcı: görünür etkileşimli öğeler
    E("()=>{window.decideCardOpen=()=>{if(getComputedStyle(document.getElementById('decideCard')).display==='none')showDraft({still:true});}}")
    IA="""()=>{window.__ia=()=>{const sel='button,a[href],[onclick],input:not([type=hidden]),select,textarea,label.chk,.dchip,[role=button],[role=switch],[role=tab]';
      return [...document.querySelectorAll(sel)].filter(e=>{const r=e.getBoundingClientRect(),cs=getComputedStyle(e);
        if(r.width<2||r.height<2||cs.visibility==='hidden'||cs.display==='none'||+cs.opacity===0)return false;
        const dd=e.closest('details:not([open])');if(dd&&!e.closest('summary'))return false;
        let x=e.parentElement;while(x&&x!==document.body){const c=getComputedStyle(x);if(c.display==='none'||c.visibility==='hidden'||+c.opacity===0)return false;
          if(/(hidden|clip|auto|scroll)/.test(c.overflow+c.overflowX+c.overflowY)){const q=x.getBoundingClientRect();if(r.right<=q.left+1||r.left>=q.right-1||r.bottom<=q.top+1||r.top>=q.bottom-1)return false;}
          x=x.parentElement;}return true;});};
      window.__desc=e=>{if(!e)return 'yok';const t=(e.innerText||e.value||e.getAttribute('aria-label')||e.placeholder||'').trim().replace(/\\s+/g,' ').slice(0,40);return e.tagName.toLowerCase()+(e.id?'#'+e.id:'')+(e.className&&typeof e.className==='string'?'.'+e.className.trim().split(/\\s+/).slice(0,2).join('.'):'')+(t?' «'+t+'»':'');};}"""
    E(IA)
    def static(name):
        # 1) yatay taşma
        ov = E("()=>({sw:document.documentElement.scrollWidth,iw:innerWidth})")
        if ov["sw"] > ov["iw"] + 1: F(f"[{DEV}/{name}] sayfa yana kayıyor: {ov['sw']} > {ov['iw']}")
        # 2) ekran dışına taşan görünür öğeler (yatay kaydırılan kutular hariç)
        out = E("""()=>{const W=innerWidth,o=[];document.querySelectorAll('body *').forEach(e=>{const r=e.getBoundingClientRect();if(r.width<1||r.height<1)return;
          if(r.right<=W+1&&r.left>=-1)return;let x=e.parentElement,scr=false;while(x){const c=getComputedStyle(x);if(/(auto|scroll|hidden)/.test(c.overflowX)&&x!==document.body&&x!==document.documentElement){scr=true;break;}x=x.parentElement;}
          if(scr)return;const c=getComputedStyle(e);if(c.position==='fixed'&&(r.right<0||r.left>W))return;if(c.visibility==='hidden'||c.display==='none')return;o.push(__desc(e)+' ['+Math.round(r.left)+'..'+Math.round(r.right)+']');});return o.slice(0,6);}""")
        for x in out: F(f"[{DEV}/{name}] ekran dışına taşıyor: {x}")
        # 3) etkileşimli öğeler: üstü kapalı mı, küçük mü, imleç
        res = E("""()=>{const L=__ia(),o={hidden:[],small:[],cursor:[],n:L.length};const touch=matchMedia('(pointer:coarse)').matches;
          for(const e of L.slice(0,160)){if(e.closest('#wizard')&&!document.getElementById('wizard').classList.contains('on'))continue;
            e.scrollIntoView({block:'center',inline:'center'});const r=e.getBoundingClientRect();if(r.bottom<0||r.top>innerHeight)continue;
            const cx=Math.min(innerWidth-1,Math.max(0,r.left+r.width/2)),cy=Math.min(innerHeight-1,Math.max(0,r.top+r.height/2));const h=document.elementFromPoint(cx,cy);
            const lab=e.tagName==='INPUT'&&e.closest('label');
            if(h&&h!==e&&!e.contains(h)&&!h.contains(e)&&!(lab&&lab.contains(h))&&!(e.id&&h.closest&&h.closest('label[for="'+e.id+'"]')))o.hidden.push(__desc(e)+' ← '+__desc(h));
            if(touch&&(r.height<28||r.width<28)&&!['INPUT','SELECT','TEXTAREA'].includes(e.tagName)&&!e.closest('.cal,.prefcal,#prefCal,.mgrid,.daychips'))o.small.push(__desc(e)+' '+Math.round(r.width)+'x'+Math.round(r.height));
            if(!touch&&['BUTTON','A'].includes(e.tagName)&&!e.disabled&&getComputedStyle(e).cursor!=='pointer')o.cursor.push(__desc(e));}
          window.scrollTo(0,0);return o;}""")
        for x in res["hidden"][:8]: F(f"[{DEV}/{name}] basılamıyor (üstü kapalı): {x}")
        for x in res["small"][:8]: W(f"[{DEV}/{name}] küçük dokunma hedefi: {x}")
        for x in res["cursor"][:8]: W(f"[{DEV}/{name}] imleç el değil: {x}")
        return res["n"]
    def close_overlays():
        # açık perde/sihirbaz/menü kapat: bilgisayarda Esc, telefonda kapat düğmesi
        for _ in range(4):
            on = E("()=>[...document.querySelectorAll('.modal.on,#wizard.is-open,.nd-sheet.is-open')].map(e=>e.id||e.className)")
            if not on: return
            if DEV == "desktop":
                pg.keyboard.press("Escape"); time.sleep(0.4)
                on2 = E("()=>[...document.querySelectorAll('.modal.on,#wizard.is-open,.nd-sheet.is-open')].map(e=>e.id||e.className)")
                if on2 == on: W(f"[{DEV}] Esc açık pencereyi kapatmadı: {on}"); E("()=>{try{if(document.querySelector('#wizard.is-open'))wzClose();}catch(e){};document.querySelectorAll('.modal.on').forEach(x=>x.classList.remove('on'));}")
            else:
                if E("()=>!!document.querySelector('#wizard.is-open')"): E("()=>wzClose()")
                else:
                    m = pg.locator(".modal.on").last
                    if m.count(): pg.touchscreen.tap(8, 60)   # perdenin dışına (üstteki karartmaya) dokun
                    else: E("()=>{const s=document.querySelector('.nd-sheet.is-open');if(s){const b=s.querySelector('[aria-label=Kapat]');if(b)b.click();}}")
                time.sleep(0.45)
                if E("()=>document.querySelectorAll('.modal.on,#wizard.is-open,.nd-sheet.is-open').length") and _ == 3: W(f"[{DEV}] perde dışına dokununca kapanmadı: {on}")
    total = 0
    for name, js in SCREENS:
        load(); E("()=>{window.decideCardOpen=()=>{if(getComputedStyle(document.getElementById('decideCard')).display==='none')showDraft({still:true});}}")
        E(IA)
        errs.clear()
        try: E("()=>{" + js + "}")
        except Exception as e: F(f"[{DEV}/{name}] açılamadı: {str(e)[:200]}"); continue
        time.sleep(0.8)
        if name == "taslak":
            for i in range(200):
                if not E("ALT.busy||RD_BUSY"): break
                time.sleep(0.5)
        try: n = static(name); total += n
        except Exception as e: F(f"[{DEV}/{name}] denetlenemedi: {str(e)[:200]}"); n = 0
        pg.screenshot(path=f"{OUT}/{name}.png")
        # her etkileşimli öğeye tek tek bas (yıkıcı olanlar hariç), sonra ekrana geri dön
        ids = E(f"()=>__ia().map((e,i)=>{{e.dataset.crawl=i;return [i,__desc(e),{SKIP}.test(e.innerText||e.getAttribute('aria-label')||'')]}})")
        clicked = 0
        if name == "taslak": E("()=>{window.__dr=draft}")
        reset = js.replace("generate()", "(window.__dr&&(draft=__dr,decideCardOpen()))")
        seen = {}
        for i, d, skip in ids[:120]:
            k = seen.get(d, 0); seen[d] = k + 1
            if skip: continue
            try:
                E("()=>{" + reset + "}"); time.sleep(0.15)
                d2 = E(f"()=>{{const L=__ia();document.querySelectorAll('[data-crawl]').forEach(x=>x.removeAttribute('data-crawl'));const M=L.filter(e=>__desc(e)==={json.dumps(d)});const e=M[{k}];if(!e)return null;e.dataset.crawl='{i}';return __desc(e)}}")
            except Exception: continue
            if d2 != d: continue
            loc = pg.locator(f"[data-crawl='{i}']")
            if loc.count() != 1: continue
            try:
                if not loc.is_visible(): continue
                loc.scroll_into_view_if_needed(timeout=2000)
                if DEV == "desktop": loc.click(timeout=2500, no_wait_after=True)
                else: loc.tap(timeout=2500, no_wait_after=True)
                clicked += 1
            except Exception as e:
                msg = str(e).split("\n")[0][:160]
                if "intercepts pointer events" in str(e): F(f"[{DEV}/{name}] basılamıyor: {d} ({msg})")
                continue
            time.sleep(0.35)
            if errs: F(f"[{DEV}/{name}] {d} → JS hatası: {errs[:2]}"); errs.clear()
            # perde açıldıysa: arka sayfa kayıyor mu (telefon), sonra kapat
            on = E("()=>!!document.querySelector('.modal.on,#wizard.is-open,.nd-sheet.is-open')")
            if on and DEV != "desktop":
                y0 = E("()=>scrollY"); pg.mouse.wheel(0, 400); time.sleep(0.2)
                if E("()=>scrollY") != y0: W(f"[{DEV}/{name}] perde açıkken arka sayfa kaydı ({d})")
            close_overlays()
            time.sleep(0.1)
        print(f"[{DEV}] {name}: {n} etkileşimli öğe, {clicked} tıklandı")
    # maymun: rastgele ekran + rastgele tıklama
    rnd = random.Random(7)
    for k in range(MONKEY):
        name, js = rnd.choice(SCREENS[:-1])
        try: E("()=>{" + js + "}")
        except Exception: continue
        time.sleep(0.3)
        n = E("()=>__ia().length")
        if not n: continue
        j = rnd.randrange(n)
        d = E(f"()=>{{const e=__ia()[{j}];e.dataset.mk='1';return [__desc(e),{SKIP}.test(e.innerText||'')]}}")
        if d[1]: continue
        try:
            loc = pg.locator("[data-mk='1']").first
            if DEV == "desktop": loc.click(timeout=2000, no_wait_after=True)
            else: loc.tap(timeout=2000, no_wait_after=True)
        except Exception: pass
        E("()=>document.querySelectorAll('[data-mk]').forEach(e=>e.removeAttribute('data-mk'))")
        time.sleep(0.3)
        if errs: F(f"[{DEV}/maymun {name}] {d[0]} → JS: {errs[:2]}"); errs.clear()
        if rnd.random() < 0.5: close_overlays()
    print(f"SONUÇ [{DEV}]: {len(fails)} hata, {len(warns)} uyarı, {total} öğe denetlendi")
    json.dump({"fails": fails, "warns": warns}, open(f"{OUT}/sonuc.json", "w"), ensure_ascii=False, indent=1)
    for x in sorted(set(warns))[:60]: print("  ·", x)
    b.close()
