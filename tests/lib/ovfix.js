/* Bir çözüm önerisinin bu aya özel geçici kurallarını (ov) fikstüre uygular: denetçi öneriyi kendi kurallarıyla denetlesin. */
function applyOv(fx, ov) {
  const F = JSON.parse(JSON.stringify(fx));
  if (!ov) return { F, o: {} };
  const D = F.db.departments[0], O = D.opts = D.opts || {}, o = {};
  if (ov.rr !== undefined) { if (ov.rr) O.rhythm = { ...ov.rr, on: true }; else delete O.rhythm; }
  if (ov.pat) { D.pattern_on = ov.pat.on || 0; D.pattern_off = ov.pat.off || 0; }
  if (ov.sen) O.sen = { ...ov.sen, on: true };
  if (ov.gen) O.gen = { ...ov.gen };
  if (ov.wr) O.wr = { ...(O.wr || {}), ...(ov.wr.max ? { max: ov.wr.max.slice() } : {}), ...(ov.wr.off ? { off: ov.wr.off.slice() } : {}) };
  if (ov.minRest != null) O.min_rest_h = ov.minRest;
  if (ov.rulesOff) O.rules = (O.rules || []).filter(r => !ov.rulesOff.includes(r.id));
  if (ov.rulesRel) O.rules = (O.rules || []).map(r => ov.rulesRel[r.id] ? { ...r, ...ov.rulesRel[r.id] } : r);
  if (ov.dneed) o.dneed = ov.dneed;
  if (ov.keep) o.allowEmpty = true;
  if (ov.fill) D.fill_policy = "fill_all";
  if (ov.free || ov.tg || ov.flex) o.noTargets = true;
  if (ov.nFree || ov.free) o.noNights = true;
  return { F, o };
}
module.exports = { applyOv };
