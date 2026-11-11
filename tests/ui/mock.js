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
  return { db, client };
}


const FX=window.__FX;const {client}=makeDB(JSON.parse(JSON.stringify(FX.db)));client._session={user:{id:FX.me,email:"yonetici@test.local",user_metadata:{name:"Test Yönetici"}}};window.__db=client;window.supabase={createClient:()=>client};})();