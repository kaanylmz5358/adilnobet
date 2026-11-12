(function(){
const KEYS = { prefs: ["user_id", "dept_id", "month"], schedules: ["dept_id", "month"], memberships: ["user_id", "dept_id"] };
function makeDB(seed) {
  const db = { departments: [], memberships: [], prefs: [], schedules: [], swap_requests: [], developers: [], member_archive: [], schedule_versions: [], ...seed };
  const clone = x => JSON.parse(JSON.stringify(x));
  class Q {
    constructor(t) { this.t = t; this.f = []; this.op = "select"; this.payload = null; this.one = false; this.maybe = false; this.ord = null; }
    select(c) { this.cols = c || "*"; this.ret = true; return this; }
    eq(k, v) { this.f.push(r => r[k] === v); return this; }
    match(o) { for (const k in o) this.f.push(r => r[k] === o[k]); return this; }
    order(k, o) { this.ord = [k, o && o.ascending === false ? -1 : 1]; return this; }
    single() { this.one = true; return this; }
    maybeSingle() { this.one = true; this.maybe = true; return this; }
    update(o) { this.op = "update"; this.payload = o; return this; }
    insert(o) { this.op = "insert"; this.payload = o; return this; }
    upsert(o) { this.op = "upsert"; this.payload = o; return this; }
    delete() { this.op = "delete"; return this; }
    limit() { return this; }
    _rows() { return (db[this.t] = db[this.t] || []).filter(r => this.f.every(fn => fn(r))); }
    exec() {
      const T = (db[this.t] = db[this.t] || []);
      if (this.op === "update") { const rs = this._rows(); rs.forEach(r => Object.assign(r, clone(this.payload))); return { data: clone(rs), error: null }; }
      if (this.op === "insert") { const a = [].concat(this.payload).map(clone); a.forEach(r => { if (this.t === "swap_requests") { if (r.id == null) r.id = T.length + 1; /* gerçek tablodaki varsayılanlar */ if (r.status == null) r.status = "bekliyor"; if (r.note == null) r.note = ""; if (r.reason == null) r.reason = ""; } T.push(r); }); return { data: a, error: null }; }
      if (this.op === "upsert") {
        const a = [].concat(this.payload).map(clone), ks = KEYS[this.t] || ["id"];
        a.forEach(r => { const ex = T.find(x => ks.every(k => x[k] === r[k])); if (ex) Object.assign(ex, r); else T.push(r); });
        return { data: a, error: null };
      }
      if (this.op === "delete") { const rs = this._rows(); db[this.t] = T.filter(r => !rs.includes(r)); return { data: rs, error: null }; }
      let rs = clone(this._rows());
      if (this.t === "memberships" && /departments\(/.test(this.cols || "")) rs.forEach(r => { const d = db.departments.find(x => x.id === r.dept_id); r.departments = d ? { id: d.id, name: d.name, join_code: d.join_code } : null; });
      if (this.ord) { const [k, s] = this.ord; rs.sort((a, b) => (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * s); }
      if (this.one) { if (!rs.length) return this.maybe ? { data: null, error: null } : { data: null, error: { message: "no rows" } }; return { data: rs[0], error: null }; }
      return { data: rs, error: null };
    }
    then(res, rej) { return Promise.resolve().then(() => this.exec()).then(res, rej); }
  }
  const rpcs = {};
  const client = {
    from: t => new Q(t),
    rpc: async (name, args) => (rpcs[name] ? rpcs[name](args) : { data: null, error: null }),
    auth: {
      getSession: async () => ({ data: { session: client._session } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => ({}),
    },
    _session: null,
  };
  rpcs.other_duties = () => ({ data: [], error: null });
  /* sunucu işlevlerinin taklidi (sql/2026-11-12_yetki_sikilastirma.sql ile aynı denetimler) */
  const DERIVED = ["cnt", "hours", "night", "wk", "bay", "dc", "nc", "wec", "wdc", "mh", "md", "ek"];
  const same = (a, b) => JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);
  const canon = o => { if (Array.isArray(o)) return o.map(canon); if (o && typeof o === "object") { const r = {}; Object.keys(o).sort().forEach(k => { r[k] = canon(o[k]); }); return r; } return o; };
  const strip = d => { const o = { ...(d || {}) }; DERIVED.forEach(k => delete o[k]); delete o.asg; return canon(o); };
  const otherDaysSame = (oa, na, day) => { const ks = new Set([...Object.keys(oa || {}), ...Object.keys(na || {})]); for (const k of ks) { if (k === String(day)) continue; if (!same(canon((oa || {})[k]), canon((na || {})[k]))) return false; } return true; };
  const uid = () => client._session && client._session.user && client._session.user.id;
  const adminOf = d => db.memberships.some(m => m.user_id === uid() && m.dept_id === d && m.is_admin);
  rpcs.swap_accept = ({ req, new_data }) => {
    const r = db.swap_requests.find(x => x.id === req); if (!r) return { data: { error: "İstek bulunamadı" }, error: null };
    if (r.status !== "bekliyor") return { data: { error: "Bu istek zaten yanıtlanmış" }, error: null };
    const test = db.memberships.some(m => m.user_id === r.in_id && m.dept_id === r.dept_id && m.is_test);
    if (!(r.in_id === uid() || (adminOf(r.dept_id) && test))) return { data: { error: "Bu isteği yalnız alıcı yanıtlayabilir" }, error: null };
    const s = db.schedules.find(x => x.dept_id === r.dept_id && x.month === r.month); if (!s) return { data: { error: "Liste bulunamadı" }, error: null };
    if (!same(strip(s.data), strip(new_data))) return { data: { error: "Listede takas dışında değişiklik var" }, error: null };
    if (!otherDaysSame(s.data.asg, new_data.asg, r.day)) return { data: { error: "Takas günü dışında değişiklik var" }, error: null };
    const oa = (s.data.asg || {})[r.day] || [], na = (new_data.asg || {})[r.day] || [];
    if (oa.length !== na.length) return { data: { error: "Takas günü uyuşmuyor" }, error: null };
    let diff = 0; for (let i = 0; i < oa.length; i++) { if (same(canon(oa[i]), canon(na[i]))) continue;
      const a = { ...oa[i] }, b = { ...na[i] }; if (a.id === r.out_id && b.id === r.in_id) { delete a.id; delete b.id; if (same(canon(a), canon(b))) { diff++; continue; } } return { data: { error: "Takas günü uyuşmuyor" }, error: null }; }
    if (diff !== 1) return { data: { error: "Takas günü uyuşmuyor" }, error: null };
    s.data = clone(new_data); r.status = "kabul"; return { data: { ok: true }, error: null };
  };
  rpcs.open_claim = ({ d, mk, day, new_data }) => {
    const me = uid(); if (!me || !db.memberships.some(m => m.user_id === me && m.dept_id === d)) return { data: { error: "Bu ekibin üyesi değilsin" }, error: null };
    const dep = db.departments.find(x => x.id === d); if (((dep && dep.opts) || {}).open_mode !== "first") return { data: { error: "Bu ekipte açık nöbeti yönetici veriyor" }, error: null };
    const s = db.schedules.find(x => x.dept_id === d && x.month === mk); if (!s) return { data: { error: "Liste bulunamadı" }, error: null };
    if (!same(strip(s.data), strip(new_data))) return { data: { error: "Listede başka değişiklik var" }, error: null };
    if (!otherDaysSame(s.data.asg, new_data.asg, day)) return { data: { error: "Başka günler değişmiş" }, error: null };
    const oa = (s.data.asg || {})[day] || [], na = (new_data.asg || {})[day] || [];
    if (na.length !== oa.length + 1) return { data: { error: "O güne tek bir nöbet eklenmeli" }, error: null };
    for (let i = 0; i < oa.length; i++) { if (!same(canon(oa[i]), canon(na[i]))) return { data: { error: "O günün diğer nöbetleri değişmiş" }, error: null }; if (oa[i].id === me && !oa[i].ic) return { data: { error: "O gün zaten nöbetin var" }, error: null }; }
    if (na[oa.length].id !== me) return { data: { error: "Yalnız kendi adına nöbet alabilirsin" }, error: null };
    s.data = clone(new_data); return { data: { ok: true }, error: null };
  };
  return { db, client };
}


const FX=window.__FX;const {client}=makeDB(JSON.parse(JSON.stringify(FX.db)));client._session={user:{id:FX.me,email:"yonetici@test.local",user_metadata:{name:"Test Yönetici"}}};window.__db=client;window.supabase={createClient:()=>client};})();