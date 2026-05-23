#!/usr/bin/env node
// フロップトレーニング初級用の軽量データセットを生成。
//
// 入力: data/cash_100bb_6max_nl500_2.5x/<variant>/flop_*.json (戦略タブと同じ flop ツリー)
// 出力: public/data/flop/flop_training_v1.json (バンド別プール、同梱用に軽量化)
//
// 抽出する3系統:
//   - CB(SRP):  シングルレイズドポットの preflop アグレッサーの c-bet 頻度
//   - CB(3bet): 3bet ポット (open→3bet→call) の 3bettor(アグレッサー)の c-bet 頻度
//   - Donk:     ディフェンダーが OOP のとき、ディフェンダーの flop 先制ベット (ドンク) 頻度
//
// ノード定義 (build-cb-srp-quiz.cjs と同じ):
//   - アグレッサー IP  → CB ノード = flop_<oop>_x.json (OOP チェック後)
//   - アグレッサー OOP → CB ノード = flop_root.json (アグレッサーが先に決定)
//   - Donk ノード = flop_root.json (OOP ディフェンダーが先に決定)。アグレッサー IP のときのみ存在。
//   - rate = action_code が X(check)/F(fold)/C(call) 以外 (= R<size>/RAI) の頻度合計。

const fs = require('fs');
const path = require('path');

const CONFIG = 'cash_100bb_6max_nl500_2.5x';
const DATA_ROOT = path.resolve(__dirname, '..', 'data', CONFIG);
const OUT_DIR = path.resolve(__dirname, '..', 'public', 'data', 'flop');
const OUT_FILE = path.join(OUT_DIR, 'flop_training_v1.json');

const POSITIONS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
const POSTFLOP_ORDER = ['SB', 'BB', 'UTG', 'HJ', 'CO', 'BTN']; // earlier = OOP

const PER_BAND_CAP = 400; // バンド×potType ごとの最大ボード数 (軽量化 + 変化)

// CB の頻度バンド (出題内訳に対応)。lo<=rate<hi。
const CB_BANDS = [
  ['0-10', 0.0, 0.1], ['10-20', 0.1, 0.2], ['20-40', 0.2, 0.4],
  ['70-80', 0.7, 0.8], ['80-90', 0.8, 0.9], ['90-100', 0.9, 1.0001],
];
const DONK_BANDS = [
  ['0-5', 0.0, 0.05], ['70-100', 0.7, 1.0001],
];

/** variant 名 → preflop アクション列 [{pos, act}]。act: 'r'(raise) | 'c'(call/limp)。 */
function parseVariant(name) {
  const seq = [];
  for (let tok of name.split('_')) {
    const pos = POSITIONS.find((p) => tok.toUpperCase().startsWith(p));
    if (!pos) return null;
    const rest = tok.slice(pos.length); // 'r10' | 'c' | 'r' | ''
    const act = rest[0]; // 'r' | 'c' | undefined
    if (act !== 'r' && act !== 'c') return null; // limp の 'bb' 単独等は対象外
    seq.push({ pos, act });
  }
  return seq;
}

/** seq から {pot:'SRP'|'3bet'|null, aggressor, defender}。SRP/3bet 以外(limp/4bet+) は null。 */
function classify(seq) {
  if (!seq) return null;
  const raises = seq.filter((s) => s.act === 'r');
  if (raises.length === 1) {
    // SRP: open(r) → call(c)
    const aggressor = raises[0].pos;
    const last = seq[seq.length - 1];
    if (last.act !== 'c') return null;
    return { pot: 'SRP', aggressor, defender: last.pos };
  }
  if (raises.length === 2) {
    // 3bet pot: open(r) → 3bet(r) → call(c) で締め
    const aggressor = raises[1].pos; // 3bettor
    const last = seq[seq.length - 1];
    if (last.act !== 'c') return null;
    return { pot: '3bet', aggressor, defender: last.pos };
  }
  return null; // limp(0) / 4bet+(3+) は対象外
}

function determineRoles(aggressor, defender) {
  const aIdx = POSTFLOP_ORDER.indexOf(aggressor);
  const dIdx = POSTFLOP_ORDER.indexOf(defender);
  const [oop] = aIdx < dIdx ? [aggressor] : [defender];
  return { oop, aggressorRole: oop === aggressor ? 'OOP' : 'IP' };
}

function summarize(actions) {
  let aggr = 0;
  let check = 0;
  for (const a of actions) {
    if (a.action_code === 'X') check += a.frequency;
    else if (a.action_code !== 'F' && a.action_code !== 'C') aggr += a.frequency;
  }
  return { rate: aggr, check };
}

function compactActions(actions) {
  return actions
    .filter((a) => Math.round(a.frequency * 100) > 0)
    .map((a) => ({ code: a.action_code, freq: Number(a.frequency.toFixed(4)) }));
}

function loadNode(variant, filename) {
  const fp = path.join(DATA_ROOT, variant, filename);
  if (!fs.existsSync(fp)) return null;
  return JSON.parse(fs.readFileSync(fp, 'utf8'));
}

function bandOf(bands, rate) {
  for (const [label, lo, hi] of bands) if (rate >= lo && rate < hi) return label;
  return null;
}

/** node の solutions[] からバンド別にボードを振り分けて pools に push。 */
function collect(node, variant, hero, pot, bands, pools) {
  if (!node) return;
  for (const s of node.solutions) {
    const { rate } = summarize(s.action_solutions);
    const band = bandOf(bands, rate);
    if (!band) continue;
    const arr = pools[band];
    if (arr.length >= PER_BAND_CAP) continue;
    arr.push({
      variant, hero, pot,
      board: s.name,
      rate: Number(rate.toFixed(4)),
      actions: compactActions(s.action_solutions),
    });
  }
}

function emptyPools(bands) {
  const o = {};
  for (const [label] of bands) o[label] = [];
  return o;
}

function main() {
  if (!fs.existsSync(DATA_ROOT)) {
    console.error(`Missing flop tree data: ${DATA_ROOT} (R2 mirror 必要)`);
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const variants = fs.readdirSync(DATA_ROOT).filter((d) => fs.statSync(path.join(DATA_ROOT, d)).isDirectory());

  const cb = { SRP: emptyPools(CB_BANDS), '3bet': emptyPools(CB_BANDS) };
  const donk = emptyPools(DONK_BANDS);
  const used = { SRP: 0, '3bet': 0, donk: 0 };

  for (const variant of variants) {
    const cls = classify(parseVariant(variant));
    if (!cls) continue;
    const { pot, aggressor, defender } = cls;
    const { oop, aggressorRole } = determineRoles(aggressor, defender);

    // CB: アグレッサーの c-bet ノード
    const cbFile = aggressorRole === 'OOP' ? 'flop_root.json' : `flop_${oop.toLowerCase()}_x.json`;
    collect(loadNode(variant, cbFile), variant, aggressor, pot, CB_BANDS, cb[pot]);
    used[pot] += 1;

    // Donk: ディフェンダーが OOP のときのみ (= アグレッサー IP)。flop_root = ディフェンダー先制。
    if (aggressorRole === 'IP') {
      collect(loadNode(variant, 'flop_root.json'), variant, defender, pot, DONK_BANDS, donk);
      used.donk += 1;
    }
  }

  const out = {
    config: CONFIG,
    generated_at: new Date().toISOString(),
    note: 'Flop training (beginner) pools. rate = aggressor flop bet freq (CB) / defender OOP lead freq (donk). 1-X.',
    cb_threshold: 0.7,
    donk_threshold: 0.6,
    cb,
    donk,
  };
  fs.writeFileSync(OUT_FILE, JSON.stringify(out));

  // サマリ出力
  const count = (pools) => Object.fromEntries(Object.entries(pools).map(([k, v]) => [k, v.length]));
  console.log('CB SRP  :', count(cb.SRP));
  console.log('CB 3bet :', count(cb['3bet']));
  console.log('Donk    :', count(donk));
  console.log(`variants used: SRP/3bet cb nodes from ${used.SRP + used['3bet']} variants, donk from ${used.donk}`);
  console.log(`Wrote ${path.relative(process.cwd(), OUT_FILE)} (${(fs.statSync(OUT_FILE).size / 1024).toFixed(1)}KB)`);
}

main();
