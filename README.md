# vivechana

**Deterministic discernment scoring for architectural decisions.** Same input → same verdict. Score, don't argue.

> _Vivechana_ (विवेचना) — Sanskrit: discernment, the act of weighing and discriminating.

At any real scale, deciding "what do we build next?" by argument or gut is just **interpretation — and interpretation is hallucination.** Vivechana replaces the argument with a number you can reproduce. Give it your options, score five axes against a fixed anchor card, and it returns a ranked verdict that is **identical on every machine, every run.** No vibes, no recency bias, no loudest-voice-wins.

```
npx vivechana
```

No install, no account, no API key, no network. It runs offline.

---

## 60-second demo

```bash
npx vivechana                              # interactive wizard — walks you through the axes
npx vivechana init my-decision             # write a starter spec you can edit
npx vivechana my-decision.json             # score a spec file
npx vivechana my-decision.json --md out.md # also export a markdown record
```

Scoring a spec prints a pm2-style result:

```
  First out-of-box OSS product — universality vs domain depth   (2026-06-29)
  Vivechana V2 · K=I×L×R×Rep · V=K×F · anchors+grades enforced (no hand-waving)

  ┌────┬──────────────────────────────┬────┬────┬────┬─────┬────┬──────┬────────┬─────┐
  │  # │ Option                       │  I │  L │  R │ Rep │  F │    K │      V │ rev │
  ├────┼──────────────────────────────┼────┼────┼────┼─────┼────┼──────┼────────┼─────┤
  │ ▶1 │ Vivechana CLI                │ 6E │ 7E │ 8E │  9M │ 9M │ 3024 │  27216 │  R  │
  │  2 │ ankr-harness                 │ 6E │ 7E │ 7E │  8E │ 8M │ 2352 │  18816 │  R  │
  │  3 │ Bitmask encoding lib         │ 4E │ 8E │ 7E │  9M │ 7E │ 2016 │  14112 │  R  │
  │  4 │ ankr-ctl                     │ 5E │ 6E │ 6E │  7E │ 8M │ 1260 │  10080 │  R  │
  │  5 │ ComplyMitra (domain depth)   │ 4E │ 4E │ 3E │  3E │ 5E │  144 │    720 │  R  │
  │  6 │ Stay fully closed (null)     │ 1M │ 1M │ 1M │  1M │10M │    1 │     10 │  R  │
  └────┴──────────────────────────────┴────┴────┴────┴─────┴────┴──────┴────────┴─────┘

  ┌─ VERDICT ───────────────────────────────────────────────────────────────────┐
  │ Max-V option : Vivechana CLI                                                  │
  │ Score        : V=27216  (K=3024)   tier: flagship  [descriptive — not a gate] │
  │ Beats "Stay fully closed" : YES                                               │
  │ Reversibility: REVERSIBLE                                                     │
  │ Gate (F≥4)   : F=9 → BUILD NOW                                                │
  └───────────────────────────────────────────────────────────────────────────┘
```

That table isn't a toy — **it is the actual scorecard by which this tool was chosen to be the first thing open-sourced** out of a 290-service universe. Vivechana scored its own existence. The example ships in [`examples/oss-first-product.json`](examples/oss-first-product.json); run it yourself:

```bash
npx vivechana "$(npx vivechana examples)"
```

---

## The model

```
K = I × L × R × Rep      ← intrinsic worth (multiplicative: any weak axis drags the whole)
V = K × F                ← deliverable value today
```

| Axis | | Range | What it counts |
|---|---|---|---|
| **I** | Impact | 1–10 | Who/what is *directly* affected. Facts, not projections. |
| **L** | Leverage | 1–10 | New capabilities unlocked downstream. |
| **R** | Reach | 1–10 | How far the effect propagates. |
| **Rep** | Replicability | 1–10 | Auto-propagation without human effort. 10 = works on case #1000 with no new code. 1 = manual every time. |
| **F** | Feasibility | 1–10 | Buildable *right now*? The only axis recomputed each time — never stored. |

Because the formula is **multiplicative**, you can't paper over a fatal weakness with strength elsewhere — a brilliant idea that's manual-forever (Rep=2) or unbuildable (F=1) scores low, on purpose. This is the **Jugaad Elimination Property**: clever-but-unscalable hacks can't win.

### The four guards — why the score is trustworthy

| Guard | Rule |
|---|---|
| **012 reversibility veto** | An `IRREVERSIBLE` option cannot rank #1 on V alone — irreversible bets must earn it another way. |
| **013 anchor card** | Every axis value must cite a fixed anchor (`9-10` / `5` / `1-2`). No bare numbers. The tool *refuses* an un-anchored axis. |
| **014 evidence grade** | Every axis is graded **M**easured / **E**stimated / **G**uessed — so a confident-looking score wears its uncertainty on its sleeve. |
| **015 null baseline** | A scored "do nothing" option is **required**. If your best real option can't beat doing nothing, "not yet" is the honest verdict. |

### Build-now gate is **F≥4**, not a V threshold

`V` is **priority** (which to do first), not a green light. The build-now gate is **feasibility (F≥4)**. A high-V idea that isn't buildable yet is a *futures contract*, not a task. This keeps the frugal, high-feasibility, modest-V lane alive — which is usually where real shipping happens.

---

## Use it as a library

```js
import { scoreSpec } from 'vivechana';

const res = scoreSpec(spec);   // pure: no fs, no network, no env
// → { ok, ranked, bestReal, beatsNull, shipNow, vTier, ... }
```

`scoreSpec` is deterministic and side-effect-free — drop it into CI to gate a roadmap, or have an agent call it to justify a choice.

---

## Provenance

Vivechana is a published method, deposited on Zenodo by its author:

- **3-axis original (prior-art anchor):** [10.5281/zenodo.19248146](https://doi.org/10.5281/zenodo.19248146)
- **5-axis protocol:** [10.5281/zenodo.19456053](https://doi.org/10.5281/zenodo.19456053)
- **V2 Guards layer (012–015):** [10.5281/zenodo.20589218](https://doi.org/10.5281/zenodo.20589218)

Author: **Capt. Anil Kumar Sharma.** This CLI is the reference implementation of the V2 protocol.

## License

[AGPL-3.0-only](LICENSE). The scoring engine, anchor card, and guards are open. Use it, fork it, build on it — derivatives stay open.
