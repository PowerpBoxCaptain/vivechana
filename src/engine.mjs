/**
 * engine.mjs — Vivechana V2 deterministic scorer (VIVECHANA-001..015).
 *
 *   K = I × L × R × Rep        V = K × F        (axes 1–10 · K 1–10000 · V 1–100000)
 *
 * Kills hand-wavy scoring: you CANNOT produce a V without, per axis,
 *   (1) a value 1–10, (2) a citation to the fixed anchor card, (3) an evidence grade M/E/G.
 * Same spec → same V, always.
 *
 * Guards: 012 reversibility veto (IRREVERSIBLE can't rank #1 on V alone) · 013 anchor card ·
 *         014 evidence grade · 015 null baseline (a scored do-nothing option is required).
 *
 * Pure: no filesystem, no network, no environment. Import scoreSpec() and pass a spec object.
 * Protocol: Zenodo 10.5281/zenodo.19248146 (3-axis) · 19456053 (5-axis) · 20589218 (v2 guards).
 */

// VIVECHANA-013 — the IMMUTABLE anchor card. Same every run, every machine.
// The anchors are deliberately generic (a builder's universe of services/surfaces)
// so the tool scores any architectural decision, not just one project's.
export const ANCHORS = {
  I:   { '9-10': 'the whole system / all users',          '5': 'one team / one desk',          '1-2': 'one script / one corner' },
  L:   { '9-10': 'binary-proof primitive everything builds on', '5': 'a new view or surface',   '1-2': 'a cosmetic change' },
  R:   { '9-10': 'every integration / the whole org',     '5': "one service's surfaces",        '1-2': 'a single record' },
  Rep: { '9-10': 'auto-propagates with no code (hook/encoding)', '5': 'reusable with per-case wiring', '1-2': 'manual every single time' },
  F:   { '9-10': 'exists / trivial',                      '5': 'buildable in 2–3 weeks',        '1-2': 'blocked, needs new infra' },
};
export const AXES = ['I', 'L', 'R', 'Rep', 'F'];
export const AXIS_NAMES = { I: 'Impact', L: 'Leverage', R: 'Reach', Rep: 'Replicability', F: 'Feasibility' };
export const GRADES = { M: 'measured', E: 'estimated', G: 'guessed' };
export const REV = ['REVERSIBLE', 'RECOVERABLE', 'IRREVERSIBLE'];

function scoreOption(o, i, errs) {
  if (!REV.includes(o.reversibility)) {
    errs.push(`option[${i}] "${o.name || '?'}": reversibility must be one of ${REV.join('/')} (VIVECHANA-012)`);
  }
  const a = {};
  for (const ax of AXES) {
    const e = (o.axes || {})[ax];
    if (!e || typeof e.v !== 'number' || e.v < 1 || e.v > 10) {
      errs.push(`option[${i}] "${o.name || '?'}": axis ${ax} needs a value 1–10`);
    } else if (!e.anchor || !e.anchor.trim()) {
      errs.push(`option[${i}] "${o.name}": axis ${ax}=${e.v} has NO anchor citation — hand-wavy (VIVECHANA-013). ` +
        `Cite vs: 9-10="${ANCHORS[ax]['9-10']}" · 5="${ANCHORS[ax]['5']}" · 1-2="${ANCHORS[ax]['1-2']}"`);
    } else if (!GRADES[e.grade]) {
      errs.push(`option[${i}] "${o.name}": axis ${ax} needs an evidence grade M/E/G (VIVECHANA-014)`);
    }
    if (e) a[ax] = e;
  }
  const K = (a.I?.v || 0) * (a.L?.v || 0) * (a.R?.v || 0) * (a.Rep?.v || 0);
  const V = K * (a.F?.v || 0);
  return { ...o, a, K, V };
}

export function vTierOf(V) {
  return V >= 24000 ? 'flagship' : V >= 12000 ? 'major' : V >= 4000 ? 'standard' : 'minor';
}

/**
 * scoreSpec(spec) → { ok, errs, ranked, real, nullOpt, bestReal, beatsNull, shipNow, vTier }
 * Throws nothing; on invalid spec returns { ok:false, errs:[...] }.
 */
export function scoreSpec(spec) {
  const errs = [];
  const opts = (spec.options || []).map((o, i) => scoreOption(o, i, errs));
  if (!opts.some((o) => o.null)) {
    errs.push('VIVECHANA-015: a scored do-nothing/defer option (null:true) is REQUIRED.');
  }
  if (errs.length) return { ok: false, errs };

  const ranked = [...opts].sort((x, y) => y.V - x.V);
  const real = opts.filter((o) => !o.null).sort((a, b) => b.V - a.V);
  const nullOpt = opts.find((o) => o.null);
  const bestReal = real[0];
  const beatsNull = bestReal && nullOpt ? bestReal.V > nullOpt.V : true;
  // VIVECHANA-012: IRREVERSIBLE cannot take #1 on V alone.
  const topByV = ranked.find((o) => o.reversibility !== 'IRREVERSIBLE') || ranked[0];
  // sequencing rule: ship LIVE only at F≥4 (the build-now gate is feasibility, NOT a V threshold).
  const shipNow = !!bestReal && bestReal.a.F.v >= 4;

  return {
    ok: true, errs: [], opts, ranked, real, nullOpt, bestReal, topByV,
    beatsNull, shipNow, vTier: bestReal ? vTierOf(bestReal.V) : null,
  };
}
