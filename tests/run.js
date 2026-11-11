/* Nöbet Defteri test koşucusu.
   node run.js hizli          ~10 dk: özellik testleri + 40 düşman senaryo + telefon arayüz taraması
   node run.js tam            ~1-2 sa: hepsi (batarya, özellikler, 300+ düşman senaryo, telefon/bilgisayar/tablet arayüz)
   node run.js fuzz 500       yalnız düşman senaryolar (yeni tohumlar + eski hatalı tohumlar)
   node run.js batarya | ozellik | arayuz
   Sonuç: out/RAPOR.md (özet) + out/ altında ayrıntılar. Hata varsa çıkış kodu 1. */
const { spawn } = require("child_process");
const fs = require("fs"), path = require("path"), os = require("os");
const T = __dirname, OUT = path.join(T, "out");
fs.mkdirSync(OUT, { recursive: true });
const level = process.argv[2] || "hizli", arg = +process.argv[3] || 0;
const CPU = Math.max(1, Math.min(4, os.cpus().length));
const t0 = Date.now(), R = [];   // {grup, ad, ok, sure, not}

function sh(cmd, args, opt = {}) {
  return new Promise(res => {
    const t = Date.now(), p = spawn(cmd, args, { cwd: T, env: { ...process.env, ...(opt.env || {}) } });
    let out = "";
    p.stdout.on("data", d => { out += d; if (opt.live) process.stdout.write(d); });
    p.stderr.on("data", d => { out += d; });
    const to = setTimeout(() => { out += "\n[ZAMAN AŞIMI]"; p.kill("SIGKILL"); }, opt.timeout || 3600e3);
    p.on("close", code => { clearTimeout(to); res({ code, out, ms: Date.now() - t }); });
  });
}
const dk = ms => (ms / 60000).toFixed(1) + " dk";

async function ozellik() {
  const files = fs.readdirSync(path.join(T, "feat")).filter(f => f.endsWith(".js")).sort();
  for (const f of files) {
    const r = await sh("node", [path.join("feat", f)], { timeout: 900e3 });
    const sonuc = (r.out.match(/SONUÇ:\s*(.*)/) || [])[1] || "";
    const bad = r.code !== 0 || /\n✗ /.test("\n" + r.out) || (sonuc && !/^TAMAM/.test(sonuc)) || /ZAMAN AŞIMI/.test(r.out);
    fs.writeFileSync(path.join(OUT, "feat_" + f.replace(/\.js$/, ".log")), r.out);
    R.push({ grup: "Özellik", ad: f.replace(/\.js$/, ""), ok: !bad, sure: r.ms, not: bad ? (r.out.split("\n").filter(l => /^✗|SONUÇ|Error|ZAMAN/.test(l)).slice(0, 3).join(" · ") || "çıkış " + r.code) : "" });
    console.log(`${bad ? "✗" : "✓"} özellik ${f} (${dk(r.ms)})`);
  }
}
async function batarya() {
  const r = await sh("node", ["battery.js"], { timeout: 5400e3 });
  fs.writeFileSync(path.join(OUT, "batarya.log"), r.out);
  const lines = r.out.split("\n").filter(l => /^(🔴|🟠|💥|🟢|🟡)/.test(l));
  const bad = lines.filter(l => !/^(🟢|🟡)/.test(l));
  const altBad = r.out.split("\n").filter(l => /^\s+öneri \d+ \[(?!base)[^\]]*\] ✗/.test(l));
  R.push({ grup: "Batarya", ad: `${lines.length} uç durum`, ok: !bad.length && !altBad.length && r.code === 0, sure: r.ms, not: [...bad, ...altBad].slice(0, 4).join(" · ") });
  console.log(`${bad.length || altBad.length ? "✗" : "✓"} batarya ${lines.length} senaryo (${dk(r.ms)})`);
}
async function fuzz(n) {
  // her çalıştırmada yeni tohumlar (tarihten) + daha önce hata vermiş tohumlar (regress_seeds.txt)
  const base = 100000 + (Math.floor(Date.now() / 864e5) % 5000) * 1000;
  const reg = fs.existsSync(path.join(T, "regress_seeds.txt")) ? fs.readFileSync(path.join(T, "regress_seeds.txt"), "utf8").split(/\s+/).filter(x => /^\d+$/.test(x)) : [];
  const parts = [], per = Math.ceil(n / CPU);
  for (let k = 0; k < CPU; k++) parts.push(sh("node", ["fuzz.js", "--from", String(base + k * per), "--n", String(Math.min(per, n - k * per)), "--suggest", "0.5", "--redraft", "0.3", "--out", path.join(OUT, `fuzz_${k}.jsonl`)], { timeout: 7200e3 }));
  if (reg.length) parts.push(sh("node", ["fuzz.js", "--seed-list", reg.join(","), "--suggest", "1", "--redraft", "0.5", "--out", path.join(OUT, "fuzz_regress.jsonl")], { timeout: 7200e3 }));
  ["fuzz_0", "fuzz_1", "fuzz_2", "fuzz_3", "fuzz_regress"].forEach(f => { try { fs.unlinkSync(path.join(OUT, f + ".jsonl")); } catch (e) {} });
  const rs = await Promise.all(parts);
  const log = rs.map(r => r.out).join("\n");
  fs.writeFileSync(path.join(OUT, "fuzz.log"), log);
  const fails = log.split("\n").filter(l => l.startsWith("✗")), total = (log.match(/^[✓✗] #/gm) || []).length;
  const det = log.split("\n").reduce((a, l, i, L) => { if (l.startsWith("✗")) { a.push(l + " " + (L[i + 1] || "").trim()); } return a; }, []);
  // aile özeti
  const fam = {};
  fs.readdirSync(OUT).filter(f => /^fuzz_.*\.jsonl$/.test(f)).forEach(f => fs.readFileSync(path.join(OUT, f), "utf8").trim().split("\n").filter(Boolean).forEach(l => {
    try { const r = JSON.parse(l); (r.fails || []).forEach(x => { const k = (x.match(/^(ASLA OLMAMALI \[\w+\]|SESSİZ İHLAL \[\w+\]|ÖNERİ|"kusursuz"|yeniden hazırla|JS|HATA|taslak)/) || ["diğer"])[0]; fam[k] = (fam[k] || 0) + 1; }); } catch (e) {} }));
  R.push({ grup: "Düşman senaryo", ad: `${total} rastgele ekip (tohum ${base}…, +${reg.length} eski)`, ok: !fails.length, sure: Math.max(...rs.map(r => r.ms)), not: det.slice(0, 6).join(" ⏎ "), fam });
  console.log(`${fails.length ? "✗" : "✓"} düşman senaryo: ${total} senaryo, ${fails.length} hatalı`);
}
async function hareket() {
  for (const dev of ["phone", "desktop"]) {
    const r = await sh("python3", [path.join("ui", "gestures.py"), dev], { timeout: 900e3 });
    fs.writeFileSync(path.join(OUT, `hareket_${dev}.log`), r.out);
    const m = r.out.match(/SONUÇ \[\w+\]: (.*)/), ok = !!m && /^TAMAM/.test(m[1]) && r.code === 0;
    R.push({ grup: "Hareket", ad: dev === "phone" ? "telefon: dokun, sürükle, fiske, kenardan geri" : "bilgisayar: fare, tekerlek, klavye", ok, sure: r.ms, not: ok ? m[1] : r.out.split("\n").filter(l => /^✗|Error/.test(l)).slice(0, 4).join(" · ") || r.out.slice(-200) });
    console.log(`${ok ? "✓" : "✗"} hareket ${dev} (${dk(r.ms)})`);
  }
}
async function guvenlik() {
  const r = await sh("python3", [path.join("ui", "xss.py")], { timeout: 1200e3 });
  fs.writeFileSync(path.join(OUT, "guvenlik.log"), r.out);
  const ok = /SONUÇ \[xss\]: TAMAM/.test(r.out) && r.code === 0;
  R.push({ grup: "Güvenlik", ad: "üye metinleri (ad, not, etiket…) kod olarak çalışmıyor", ok, sure: r.ms, not: ok ? "" : r.out.split("\n").filter(l => /^✗|SONUÇ|Error/.test(l)).slice(0, 4).join(" · ") });
  console.log(`${ok ? "✓" : "✗"} güvenlik (${dk(r.ms)})`);
}
async function arayuz(cihazlar, monkey) {
  for (const fx of ["fx_shift.json", "fx_room.json", "fx_uye.json"]) for (const dev of cihazlar) {
    if (fx === "fx_uye.json" && !["phone", "desktop"].includes(dev)) continue;
    const args = [path.join("ui", "crawl.py"), dev, fx]; if (monkey && fx === "fx_shift.json") args.push("--monkey", String(monkey));
    const r = await sh("python3", args, { timeout: 3500e3 });
    fs.writeFileSync(path.join(OUT, `arayuz_${dev}_${fx.replace(".json", "")}.log`), r.out);
    const m = r.out.match(/SONUÇ \[\w+\]: (\d+) hata, (\d+) uyarı, (\d+) öğe/);
    const ok = !!m && +m[1] === 0 && r.code === 0;
    const hata = r.out.split("\n").filter(l => /✗|HATA|Error/.test(l)).slice(0, 3).join(" · ");
    R.push({ grup: "Arayüz", ad: `${dev} · ${fx.includes("room") ? "oda ekibi" : fx.includes("uye") ? "üye gözüyle" : "vardiyalı ekip"}`, ok, sure: r.ms, not: ok ? (m ? `${m[3]} öğe, ${m[2]} uyarı` : "") : (hata || (m ? m[0] : "çalışmadı: " + r.out.slice(-200))) });
    console.log(`${ok ? "✓" : "✗"} arayüz ${dev} ${fx} (${dk(r.ms)})`);
  }
}
function rapor() {
  const bad = R.filter(r => !r.ok);
  let md = `# Test raporu — ${new Date().toISOString().slice(0, 16).replace("T", " ")}\n\nDüzey: **${level}** · süre ${dk(Date.now() - t0)} · ${R.length} kalem, **${bad.length} sorunlu**\n\n| | Grup | Kalem | Süre | Not |\n|---|---|---|---|---|\n`;
  R.forEach(r => { md += `| ${r.ok ? "✅" : "❌"} | ${r.grup} | ${r.ad} | ${dk(r.sure)} | ${String(r.not || "").replace(/\|/g, "/").slice(0, 400)} |\n`; });
  const fz = R.find(r => r.fam && Object.keys(r.fam).length);
  if (fz) md += `\n## Düşman senaryo hata aileleri\n\n` + Object.entries(fz.fam).map(([k, v]) => `- ${k}: ${v}`).join("\n") + "\n";
  md += `\nAyrıntılar: out/ klasörü (fuzz.log, fuzz_*.jsonl, batarya.log, feat_*.log, arayuz_*.log, ui_*/ ekran görüntüleri).\n`;
  fs.writeFileSync(path.join(OUT, "RAPOR.md"), md);
  console.log("\n" + md);
  process.exit(bad.length ? 1 : 0);
}
(async () => {
  if (!fs.existsSync(path.join(T, "node_modules", "jsdom"))) { console.log("Önce: cd tests && npm install"); process.exit(2); }
  if (!fs.existsSync(path.join(T, "ui", "fx_uye.json"))) await sh("node", [path.join("ui", "make_fixtures.js")]);
  if (level === "hizli") { await ozellik(); await fuzz(arg || 40); await hareket(); await guvenlik(); await arayuz(["phone"], 0); }
  else if (level === "tam") { await ozellik(); await batarya(); await fuzz(arg || 300); await hareket(); await guvenlik(); await arayuz(["phone", "desktop", "tablet", "android", "small"], 120); }
  else if (level === "fuzz") await fuzz(arg || 200);
  else if (level === "batarya") await batarya();
  else if (level === "ozellik") await ozellik();
  else if (level === "arayuz") { await hareket(); await guvenlik(); await arayuz(["phone", "desktop", "tablet", "android", "small"], arg || 150); }
  else { console.log("Bilinmeyen düzey: " + level); process.exit(2); }
  rapor();
})();
