/**
 * render.mjs — pm2-style terminal UI for Vivechana results.
 * Zero-dependency: hand-rolled ANSI + box-drawing. Honors NO_COLOR and non-TTY (strips color).
 */
import { AXES } from './engine.mjs';

const useColor = process.env.NO_COLOR === undefined && process.stdout.isTTY;
const C = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : String(s));
const c = {
  bold: C('1'), dim: C('2'), red: C('31'), green: C('32'), yellow: C('33'),
  blue: C('34'), magenta: C('35'), cyan: C('36'), gray: C('90'),
  greenBold: C('1;32'), dimItalic: C('2;3'),
};

const stripAnsi = (s) => String(s).replace(/\x1b\[[0-9;]*m/g, '');
const width = (s) => stripAnsi(s).length;
const pad = (s, w, align = 'left') => {
  const gap = Math.max(0, w - width(s));
  if (align === 'right') return ' '.repeat(gap) + s;
  if (align === 'center') { const l = gap >> 1; return ' '.repeat(l) + s + ' '.repeat(gap - l); }
  return s + ' '.repeat(gap);
};

/** Render an array of row-objects as a pm2-style boxed table. */
export function table(headers, rows, aligns = []) {
  const cols = headers.length;
  const w = headers.map((h, i) =>
    Math.max(width(h), ...rows.map((r) => width(r[i] ?? '')))
  );
  const line = (l, m, r) => l + w.map((n) => '─'.repeat(n + 2)).join(m) + r;
  const fmtRow = (cells) =>
    '│ ' + cells.map((cell, i) => pad(cell ?? '', w[i], aligns[i] || 'left')).join(' │ ') + ' │';
  const out = [];
  out.push(c.gray(line('┌', '┬', '┐')));
  out.push(fmtRow(headers.map((h) => c.bold(h))).replace(/│/g, c.gray('│')));
  out.push(c.gray(line('├', '┼', '┤')));
  for (const r of rows) out.push(fmtRow(r).replace(/│/g, c.gray('│')));
  out.push(c.gray(line('└', '┴', '┘')));
  return out.join('\n');
}

/** A titled panel box (used for the verdict). All rows are exactly inner+4 wide. */
export function panel(title, lines) {
  const inner = Math.max(width(title), ...lines.map(width));
  const W = inner + 2; // interior width: one space of padding each side
  const titleStr = ' ' + title + ' ';
  const top = c.gray('┌') + c.bold(titleStr) + c.gray('─'.repeat(Math.max(0, W - width(titleStr))) + '┐');
  const body = lines.map((l) => c.gray('│') + ' ' + pad(l, inner) + ' ' + c.gray('│'));
  const bot = c.gray('└' + '─'.repeat(W) + '┘');
  return [top, ...body, bot].join('\n');
}

/** Full result render: ranking table + verdict panel. */
export function renderResult(spec, res) {
  const headers = ['#', 'Option', ...AXES, 'K', 'V', 'rev'];
  const aligns = ['right', 'left', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'center'];
  const rows = res.ranked.map((o, i) => {
    const isWin = o === res.bestReal;
    const name = (o.null ? c.dimItalic(o.name + ' (null)') : isWin ? c.greenBold(o.name) : o.name);
    const Vcell = isWin ? c.greenBold(o.V) : o.null ? c.dim(o.V) : c.bold(o.V);
    const rankMark = isWin ? c.green('▶' + (i + 1)) : c.gray(String(i + 1));
    return [
      rankMark, name,
      ...AXES.map((ax) => `${o.a[ax].v}${c.dim(o.a[ax].grade)}`),
      c.gray(String(o.K)), Vcell, c.gray(o.reversibility[0]),
    ];
  });

  const b = res.bestReal;
  const tierColor = { flagship: c.magenta, major: c.cyan, standard: c.blue, minor: c.gray }[res.vTier] || c.gray;
  const verdict = [
    `Max-V option : ${c.greenBold(b.name)}`,
    `Score        : V=${c.bold(b.V)}  (K=${b.K})   tier: ${tierColor(res.vTier)}  ${c.dim('[descriptive label — not a gate]')}`,
    `Beats "${res.nullOpt.name}" : ${res.beatsNull ? c.green('YES') : c.red('NO — "not yet" is the decision')}`,
    `Reversibility: ${b.reversibility}${b.reversibility === 'IRREVERSIBLE' ? c.red(' — cannot rank #1 on V alone (012)') : ''}`,
    `Gate (F≥4)   : F=${b.a.F.v} → ${res.shipNow ? c.greenBold('BUILD NOW') : c.yellow('FUTURES CONTRACT (raise F first)')}`,
  ];

  const parts = [];
  parts.push('');
  parts.push(c.bold('  ' + spec.title) + c.dim(spec.date ? `   (${spec.date})` : ''));
  parts.push(c.dim('  Vivechana V2 · K=I×L×R×Rep · V=K×F · anchors+grades enforced (no hand-waving)'));
  parts.push('');
  parts.push(table(headers, rows, aligns).replace(/^/gm, '  '));
  parts.push('');
  parts.push(panel('VERDICT', verdict).replace(/^/gm, '  '));
  if (spec.note) {
    parts.push('');
    parts.push(c.dim('  note: ' + spec.note));
  }
  parts.push('');
  return parts.join('\n');
}

/** Render a spec-validation failure the same severe way the engine reports it. */
export function renderErrors(errs) {
  const lines = errs.map((e) => c.red('✗ ') + e);
  return '\n' + panel(c.red('SPEC INVALID') + c.dim(' — not deterministic / not anchored'), lines).replace(/^/gm, '  ') + '\n';
}

export { c as colors };
