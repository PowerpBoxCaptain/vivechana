#!/usr/bin/env node
/**
 * vivechana — score architectural decisions deterministically. Same input → same verdict.
 *
 *   vivechana <spec.json> [--md out.md] [--json]   score a spec file
 *   vivechana                                        interactive wizard (no file needed)
 *   vivechana init [name]                            write a starter spec you can edit
 *   vivechana examples                               print the bundled example path
 *   vivechana --help
 *
 * Protocol: Zenodo 10.5281/zenodo.19248146 · 19456053 · 20589218 (Capt. Anil Kumar Sharma).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { scoreSpec, vTierOf, ANCHORS, AXES, AXIS_NAMES, GRADES, REV } from '../src/engine.mjs';
import { renderResult, renderErrors, colors as c } from '../src/render.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const val = (f) => (args.indexOf(f) >= 0 ? args[args.indexOf(f) + 1] : null);

function help() {
  console.log(`
  ${c.bold('vivechana')} — deterministic discernment scoring for architectural decisions
  ${c.dim('K = I×L×R×Rep · V = K×F · anchors + evidence grades enforced (no hand-waving)')}

  ${c.bold('USAGE')}
    vivechana <spec.json> [--md out.md] [--json]   score a spec file
    vivechana                                       interactive wizard
    vivechana init [name]                           write a starter spec to edit
    vivechana examples                              show the bundled example
    vivechana --help

  ${c.bold('THE FIVE AXES (1–10)')}            ${c.bold('EVIDENCE GRADE')}
    I   Impact        who/what is affected     M  measured
    L   Leverage      capabilities unlocked    E  estimated
    R   Reach         how far it propagates     G  guessed
    Rep Replicability auto-propagation
    F   Feasibility   buildable right now

  ${c.bold('THE FOUR GUARDS')}
    012 reversibility veto   an IRREVERSIBLE option can't win on V alone
    013 anchor card          every axis must cite the fixed anchor
    014 evidence grade       every axis must be graded M/E/G
    015 null baseline        a scored "do nothing" option is required

  ${c.dim('Protocol: Zenodo 10.5281/zenodo.19248146 · 19456053 · 20589218')}
`);
}

function toMarkdown(spec, res) {
  const fmtAxes = (o) => AXES.map((ax) => `${ax}=${o.a[ax].v}${o.a[ax].grade}`).join(' ');
  let md = `# ${spec.title} — Vivechana V2 (${spec.date || ''})\n\n`;
  md += `> K=I×L×R×Rep · V=K×F. Anchors + evidence grades enforced (no hand-waving). `;
  md += `Protocol: Zenodo 10.5281/zenodo.19248146 · 19456053 · 20589218.\n\n`;
  md += `| Option | I | L | R | Rep | F | K | **V** | rev |\n|---|--|--|--|--|--|--:|--:|--|\n`;
  for (const o of res.ranked)
    md += `| ${o.name}${o.null ? ' (null)' : ''} | ${o.a.I.v} | ${o.a.L.v} | ${o.a.R.v} | ${o.a.Rep.v} | ${o.a.F.v} | ${o.K} | **${o.V}** | ${o.reversibility[0]} |\n`;
  md += `\n## Anchored axes (VIVECHANA-013/014)\n`;
  for (const o of res.real) {
    md += `\n**${o.name}** — ${fmtAxes(o)} · reversibility=${o.reversibility}\n`;
    for (const ax of AXES) md += `- ${ax}=${o.a[ax].v} (${o.a[ax].grade}) — ${o.a[ax].anchor}\n`;
  }
  const b = res.bestReal;
  md += `\n## Verdict\n`;
  md += `- Max-V real option: **${b.name}** (V=${b.V}, K=${b.K}).\n`;
  md += `- V-tier (descriptive label, NOT a gate; the gate is F≥4): **${res.vTier}**. flagship≥24k · major≥12k · standard≥4k · minor<4k.\n`;
  md += `- Beats null baseline (${res.nullOpt.name} V=${res.nullOpt.V}): **${res.beatsNull ? 'YES' : 'NO — "not yet" is the scored decision'}**.\n`;
  md += `- Reversibility (012): ${b.reversibility}${b.reversibility === 'IRREVERSIBLE' ? ' — cannot rank #1 on V alone' : ''}.\n`;
  md += `- Sequencing rule (ship LIVE at F≥4): F=${b.a.F.v} → **${res.shipNow ? 'BUILD NOW' : 'FUTURES CONTRACT (raise F first)'}**.\n`;
  if (spec.note) md += `\n## Note\n${spec.note}\n`;
  return md;
}

function output(spec, res) {
  if (!res.ok) {
    process.stderr.write(renderErrors(res.errs));
    process.exit(1);
  }
  if (flag('--json')) {
    const clean = {
      title: spec.title, date: spec.date, vTier: res.vTier, shipNow: res.shipNow,
      bestReal: { name: res.bestReal.name, K: res.bestReal.K, V: res.bestReal.V },
      ranked: res.ranked.map((o) => ({ name: o.name, K: o.K, V: o.V, null: !!o.null, reversibility: o.reversibility })),
    };
    console.log(JSON.stringify(clean, null, 2));
    return;
  }
  console.log(renderResult(spec, res));
  const md = val('--md');
  if (md) { writeFileSync(md, toMarkdown(spec, res)); process.stderr.write(c.dim(`  → wrote ${md}\n`)); }
}

const STARTER = {
  title: 'Untitled decision',
  date: new Date().toISOString().slice(0, 10),
  note: 'Replace these options. Every axis needs a value 1–10, an anchor citation, and a grade M/E/G.',
  options: [
    { name: 'Option A', reversibility: 'REVERSIBLE', axes: {
      I:   { v: 5, grade: 'E', anchor: 'one team / one desk' },
      L:   { v: 5, grade: 'E', anchor: 'a new view or surface' },
      R:   { v: 5, grade: 'E', anchor: "one service's surfaces" },
      Rep: { v: 5, grade: 'E', anchor: 'reusable with per-case wiring' },
      F:   { v: 6, grade: 'E', anchor: 'buildable in 2–3 weeks' } } },
    { name: 'Do nothing', null: true, reversibility: 'REVERSIBLE', axes: {
      I:   { v: 1, grade: 'M', anchor: 'no change' },
      L:   { v: 1, grade: 'M', anchor: 'no unlock' },
      R:   { v: 1, grade: 'M', anchor: 'no propagation' },
      Rep: { v: 1, grade: 'M', anchor: 'n/a' },
      F:   { v: 10, grade: 'M', anchor: 'trivially feasible to do nothing' } } },
  ],
};

async function wizard() {
  const rl = createInterface({ input: stdin, output: stdout });
  const ask = async (q, def) => {
    const a = (await rl.question(c.cyan(q) + (def !== undefined ? c.dim(` [${def}] `) : ' '))).trim();
    return a || (def !== undefined ? String(def) : '');
  };
  console.log(c.bold('\n  Vivechana wizard') + c.dim(' — Ctrl-C to abort. A "do nothing" option is added for you.\n'));
  const title = await ask('Decision title?', 'Untitled decision');
  const n = parseInt(await ask('How many real options (not counting "do nothing")?', '2'), 10) || 2;
  const options = [];
  for (let i = 0; i < n; i++) {
    console.log(c.bold(`\n  ── Option ${i + 1} ──`));
    const name = await ask('  name?', `Option ${i + 1}`);
    const reversibility = (await ask(`  reversibility (${REV.join('/')})?`, 'REVERSIBLE')).toUpperCase();
    const axes = {};
    for (const ax of AXES) {
      console.log(c.dim(`    ${ax} (${AXIS_NAMES[ax]}): 9-10="${ANCHORS[ax]['9-10']}" · 5="${ANCHORS[ax]['5']}" · 1-2="${ANCHORS[ax]['1-2']}"`));
      const v = parseInt(await ask(`    ${ax} value 1–10?`, '5'), 10);
      const grade = (await ask(`    ${ax} grade (M/E/G)?`, 'E')).toUpperCase();
      const anchor = await ask(`    ${ax} which anchor / why?`, ANCHORS[ax][v >= 9 ? '9-10' : v <= 2 ? '1-2' : '5']);
      axes[ax] = { v, grade: GRADES[grade] ? grade : 'G', anchor };
    }
    options.push({ name, reversibility: REV.includes(reversibility) ? reversibility : 'REVERSIBLE', axes });
  }
  options.push(STARTER.options[1]); // the null baseline
  rl.close();
  const spec = { title, date: new Date().toISOString().slice(0, 10), options };
  const save = spec.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) + '.json';
  writeFileSync(save, JSON.stringify(spec, null, 2));
  process.stderr.write(c.dim(`\n  → saved spec to ${save} (edit + re-run: vivechana ${save})\n`));
  output(spec, scoreSpec(spec));
}

// ── dispatch ───────────────────────────────────────────────────────────────
const cmd = args[0];
if (flag('--help') || flag('-h') || cmd === 'help') {
  help();
} else if (cmd === 'init') {
  const name = (args[1] || 'decision').replace(/[^a-z0-9-]/gi, '-');
  const file = `${name}.json`;
  writeFileSync(file, JSON.stringify(STARTER, null, 2));
  console.log(c.green(`  → wrote ${file}`) + c.dim(`  — edit it, then: vivechana ${file}`));
} else if (cmd === 'examples') {
  console.log(join(HERE, '..', 'examples', 'oss-first-product.json'));
} else if (!cmd || cmd.startsWith('-')) {
  if (cmd && cmd !== '--json' && cmd !== '--md' && !val('--spec')) { help(); process.exit(0); }
  const specPath = val('--spec');
  if (specPath) { const spec = JSON.parse(readFileSync(specPath, 'utf8')); output(spec, scoreSpec(spec)); }
  else { await wizard(); }
} else {
  // bare path: `vivechana spec.json`
  const spec = JSON.parse(readFileSync(cmd, 'utf8'));
  output(spec, scoreSpec(spec));
}
