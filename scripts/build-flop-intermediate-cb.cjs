#!/usr/bin/env node
// フロップトレーニング中級CB 用データセットを生成。
//
// 入力: data/cash_100bb_6max_nl500_2.5x/<variant>/flop_*.json (初級と同じフロップツリー)
// 出力: public/data/flop/flop_intermediate_cb_v1.json
//
// CB ノード = アグレッサーの c-bet 局面 (アグレッサー IP→flop_<oop>_x / OOP→flop_root)。
// 各ボードのアクション頻度を、ポット種別ごとの選択肢バケットに集約する:
//   SRP     : check / 33 / 50 / 75 / 125
//   3bet    : check / 20 / 33 / 50 / 75 / 125 / ALLIN  (10,25→20 / 100,150→125)
//   4bet5bet: check / 10 / 25 / 33 / 50 / ALLIN        (50%超→ALLIN)
// 出題は複数選択 (プリフロ中級方式)。中級らしさのため「混合戦略」ボードのみ収録。

const fs = require('fs');
const path = require('path');

const CONFIG = 'cash_100bb_6max_nl500_2.5x';
const DATA_ROOT = path.resolve(__dirname, '..', 'data', CONFIG);
const OUT_DIR = path.resolve(__dirname, '..', 'public', 'data', 'flop');
const OUT_FILE = path.join(OUT_DIR, 'flop_intermediate_cb_v1.json');

const POSITIONS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
const POSTFLOP_ORDER = ['SB', 'BB', 'UTG', 'HJ', 'CO', 'BTN']; // earlier = OOP
const OPEN_SIZE = 2.5;
const PER_POT_CAP = 1600; // ポット種別ごとの最大ボード数 (出題に十分な多様性 + 軽量化)
const MIXED_MIN = 0.1; // 「混合戦略」判定: この頻度以上のバケットが2つ以上

const CHOICES = {
  SRP: ['check', '33', '50', '75', '125'],
  '3bet': ['check', '20', '33', '50', '75', '125', 'ALLIN'],
  '4bet5bet': ['check', '10', '25', '33', '50', 'ALLIN'],
};

function parseVariant(name) {
  const seq = [];
  for (const tok of name.split('_')) {
    const pos = POSITIONS.find((p) => tok.toUpperCase().startsWith(p));
    if (!pos) return null;
    const act = tok.slice(pos.length)[0];
    if (act !== 'r' && act !== 'c') return null;
    seq.push({ pos, act });
  }
  return seq;
}

/** seq → { potCat, pot, aggressor, defender }。potCat = 出題プールのキー。 */
function classify(name) {
  const seq = parseVariant(name);
  if (!seq) return null;
  const raises = seq.filter((s) => s.act === 'r');
  const last = seq[seq.length - 1];
  if (raises.length < 1 || last.act !== 'c') return null;
  const aggressor = raises[raises.length - 1].pos;
  const defender = last.pos;
  let pot, potCat;
  if (raises.length === 1) { pot = 'SRP'; potCat = 'SRP'; }
  else if (raises.length === 2) { pot = '3bet'; potCat = '3bet'; }
  else if (raises.length === 3) { pot = '4bet'; potCat = '4bet5bet'; }
  else if (raises.length === 4) { pot = '5bet'; potCat = '4bet5bet'; }
  else return null;
  return { pot, potCat, aggressor, defender };
}

function roles(aggressor, defender) {
  const oop = POSTFLOP_ORDER.indexOf(aggressor) < POSTFLOP_ORDER.indexOf(defender) ? aggressor : defender;
  return { oop, aggressorRole: oop === aggressor ? 'OOP' : 'IP' };
}

function loadNode(variant, file) {
  const fp = path.join(DATA_ROOT, variant, file);
  return fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, 'utf8')) : null;
}

/** sizePct(整数) を最も近いアンカーに寄せる (同点は大きい方)。 */
function nearestAnchor(pct, anchors) {
  let best = anchors[0];
  let bestD = Infinity;
  for (const a of anchors) {
    const d = Math.abs(pct - a);
    if (d < bestD || (d === bestD && a > best)) { best = a; bestD = d; }
  }
  return String(best);
}

/** action_code を potCat のバケットラベルに変換 (X はここでは扱わない)。 */
function bucketOf(potCat, code, pot) {
  if (code === 'RAI') return potCat === 'SRP' ? '125' : 'ALLIN';
  if (code[0] !== 'R') return null;
  const n = parseFloat(code.slice(1));
  if (!Number.isFinite(n) || !pot) return null;
  const pct = Math.round((n / pot) * 100);
  if (potCat === 'SRP') return nearestAnchor(pct, [33, 50, 75, 125]);
  if (potCat === '3bet') return nearestAnchor(pct, [20, 33, 50, 75, 125]);
  // 4bet5bet: 50%超は ALLIN、それ以外は 10/25/33/50 に寄せる
  if (pct > 50) return 'ALLIN';
  return nearestAnchor(pct, [10, 25, 33, 50]);
}

/** action_solutions → バケット別頻度 (0..1)。 */
function bucketize(potCat, actions, pot) {
  const strat = {};
  for (const label of CHOICES[potCat]) strat[label] = 0;
  for (const a of actions) {
    if (a.action_code === 'F' || a.action_code === 'C') continue;
    if (a.action_code === 'X') { strat.check += a.frequency; continue; }
    if (Math.round(a.frequency * 100) <= 0) continue;
    const b = bucketOf(potCat, a.action_code, pot);
    if (b == null) continue;
    strat[b] += a.frequency;
  }
  // 丸め
  for (const k of Object.keys(strat)) strat[k] = Number(strat[k].toFixed(4));
  return strat;
}

/** 混合戦略か (MIXED_MIN 以上のバケットが2つ以上)。 */
function isMixed(strat) {
  let n = 0;
  for (const v of Object.values(strat)) if (v >= MIXED_MIN) n++;
  return n >= 2;
}

/** プリフロップ アクション列 (アニメ用)。folds → chain(raises/call)。サイズは name/invested から最善推定。 */
function buildPreflopSeq(variant, node) {
  const players = node?.game_point?.game?.players ?? [];
  const investedOf = (pos) => {
    const p = players.find((x) => x.position === pos);
    return p ? Number((100 - parseFloat(p.current_stack)).toFixed(2)) : 0;
  };
  const toks = [];
  for (const t of variant.split('_')) {
    const pos = POSITIONS.find((p) => t.toUpperCase().startsWith(p));
    if (!pos) return [];
    const rest = t.slice(pos.length);
    const num = parseFloat(rest.slice(1));
    toks.push({ pos, act: rest[0], num: Number.isFinite(num) ? num : null });
  }
  const chain = [];
  let prev = 0;
  for (const tk of toks) {
    if (tk.act === 'r') {
      let amt = tk.num != null ? tk.num : prev === 0 ? OPEN_SIZE : null;
      chain.push({ position: tk.pos, kind: 'raise', amount: amt });
      if (amt != null) prev = amt;
    } else if (tk.act === 'c') {
      chain.push({ position: tk.pos, kind: 'call' });
    }
  }
  for (let i = 0; i < chain.length; i++) {
    const c = chain[i];
    if (c.kind === 'raise' && c.amount == null) {
      const laterSame = chain.slice(i + 1).some((x) => x.position === c.position);
      const laterRaise = chain.slice(i + 1).some((x) => x.kind === 'raise');
      if (!laterSame && !laterRaise) c.amount = investedOf(c.position);
      else {
        const prevAmt = i > 0 ? chain[i - 1].amount ?? OPEN_SIZE : OPEN_SIZE;
        c.amount = Number((prevAmt * 2.3).toFixed(1));
      }
    }
  }
  const actors = new Set(toks.map((t) => t.pos));
  const folds = POSITIONS.filter((p) => !actors.has(p)).map((p) => ({ position: p, kind: 'fold' }));
  return [...folds, ...chain];
}

function main() {
  if (!fs.existsSync(DATA_ROOT)) {
    console.error(`Missing flop tree data: ${DATA_ROOT} (R2 mirror 必要)`);
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const variants = fs.readdirSync(DATA_ROOT).filter((d) => fs.statSync(path.join(DATA_ROOT, d)).isDirectory());

  const pots = { SRP: [], '3bet': [], '4bet5bet': [] };
  const preflop = {};

  for (const variant of variants) {
    const cls = classify(variant);
    if (!cls) continue;
    const { pot, potCat, aggressor, defender } = cls;
    const { oop, aggressorRole } = roles(aggressor, defender);
    const cbFile = aggressorRole === 'OOP' ? 'flop_root.json' : `flop_${oop.toLowerCase()}_x.json`;
    const node = loadNode(variant, cbFile);
    if (!node) continue;
    preflop[variant] = buildPreflopSeq(variant, loadNode(variant, 'flop_root.json'));
    const flopPot = node.game_point?.game?.pot ?? 0;
    for (const s of node.solutions) {
      if (pots[potCat].length >= PER_POT_CAP) break;
      const strat = bucketize(potCat, s.action_solutions, flopPot);
      if (!isMixed(strat)) continue; // 中級: 混合戦略ボードのみ
      pots[potCat].push({ variant, hero: aggressor, villain: defender, pot, board: s.name, strat });
    }
  }

  const out = {
    config: CONFIG,
    generated_at: new Date().toISOString(),
    note: 'Flop intermediate CB. strat = bucketed c-bet frequencies (0..1). Multi-select scoring (preflop intermediate method).',
    choices: CHOICES,
    preflop,
    pots,
  };
  fs.writeFileSync(OUT_FILE, JSON.stringify(out));
  console.log('SRP boards     :', pots.SRP.length);
  console.log('3bet boards    :', pots['3bet'].length);
  console.log('4bet5bet boards:', pots['4bet5bet'].length);
  console.log(`Wrote ${path.relative(process.cwd(), OUT_FILE)} (${(fs.statSync(OUT_FILE).size / 1024).toFixed(1)}KB)`);
}

main();
