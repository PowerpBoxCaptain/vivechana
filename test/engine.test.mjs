import { scoreSpec } from '../src/engine.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert';

const HERE = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('  ✓ ' + name); } catch (e) { fail++; console.log('  ✗ ' + name + ' — ' + e.message); } };

// determinism: same spec → same V
const spec = JSON.parse(readFileSync(join(HERE, '..', 'examples', 'oss-first-product.json'), 'utf8'));
const a = scoreSpec(spec), b = scoreSpec(spec);
t('valid spec scores ok', () => assert(a.ok));
t('deterministic (same V twice)', () => assert.equal(a.bestReal.V, b.bestReal.V));
t('Vivechana CLI wins at V=27216', () => { assert.equal(a.bestReal.name.startsWith('Vivechana CLI'), true); assert.equal(a.bestReal.V, 27216); });
t('build-now gate fires at F>=4', () => assert.equal(a.shipNow, true));
t('flagship tier', () => assert.equal(a.vTier, 'flagship'));

// guard 015: missing null baseline rejected
t('rejects spec with no null option (015)', () => {
  const noNull = { ...spec, options: spec.options.filter((o) => !o.null) };
  const r = scoreSpec(noNull);
  assert.equal(r.ok, false);
  assert(r.errs.some((e) => e.includes('015')));
});
// guard 013: un-anchored axis rejected
t('rejects un-anchored axis (013)', () => {
  const bad = JSON.parse(JSON.stringify(spec));
  bad.options[0].axes.I.anchor = '';
  const r = scoreSpec(bad);
  assert.equal(r.ok, false);
  assert(r.errs.some((e) => e.includes('013')));
});
// guard 014: missing grade rejected
t('rejects missing grade (014)', () => {
  const bad = JSON.parse(JSON.stringify(spec));
  delete bad.options[0].axes.L.grade;
  const r = scoreSpec(bad);
  assert.equal(r.ok, false);
  assert(r.errs.some((e) => e.includes('014')));
});

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
