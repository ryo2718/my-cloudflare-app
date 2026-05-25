#!/usr/bin/env node
// フロップトレーニング「中級レンジベット」用データセットを生成。
//
// 入力: data/cash_100bb_6max_nl500_2.5x/<variant>/flop_*.json (初級と同じフロップツリー)
// 出力: public/data/flop/flop_rangebet_v1.json
//
// CB問題 (複数選択, 全ポット): アグレッサーの c-bet サイズ構成。
//   ノード: アグレッサー IP→flop_<oop>_x / OOP→flop_root。選択肢 check/33/50/75/125 に集約。
//   ポット種別 SRP / 3bet / 4bet5bet (4bet+5bet を統合) でプールを分ける。混合戦略ボードのみ収録。

const fs = require('fs');
const path = require('path');

const CONFIG = 'cash_100bb_6max_nl500_2.5x';
const DATA_ROOT = path.resolve(__dirname, '..', 'data', CONFIG);
const OUT_DIR = path.resolve(__dirname, '..', 'public', 'data', 'flop');
const OUT_FILE = path.join(OUT_DIR, 'flop_rangebet_v1.json');

const POSITIONS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
const POSTFLOP_ORDER = ['SB', 'BB', 'UTG', 'HJ', 'CO', 'BTN']; // earlier = OOP
const OPEN_SIZE = 2.5;
const PER_POT_CAP = 1600; // ポット種別ごとの最大ボード数 (出題に十分な多様性 + 軽量化)
const MIXED_MIN = 0.1; // CB「混合戦略」判定: この頻度以上のバケットが2つ以上

// CB問題の選択肢 (全ポット共通)。125 = オーバーベット。
const CB_CHOICES = ['check', '33', '50', '75', '125'];

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

/** action_code を SRP の CB バケット (33/50/75/125) に寄せる。RAI→125。X はここでは扱わない。 */
function bucketSrp(code, pot) {
  if (code === 'RAI') return '125';
  if (code[0] !== 'R') return null;
  const n = parseFloat(code.slice(1));
  if (!Number.isFinite(n) || !pot) return null;
  return nearestAnchor(Math.round((n / pot) * 100), [33, 50, 75, 125]);
}

/** CB ノードの action_solutions → バケット別頻度 (0..1)。pot = 実際のフロップポット。 */
function bucketize(actions, pot) {
  const strat = {};
  for (const label of CB_CHOICES) strat[label] = 0;
  for (const a of actions) {
    if (a.action_code === 'F' || a.action_code === 'C') continue;
    if (a.action_code === 'X') { strat.check += a.frequency; continue; }
    if (Math.round(a.frequency * 100) <= 0) continue;
    const b = bucketSrp(a.action_code, pot);
    if (b == null) continue;
    strat[b] += a.frequency;
  }
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

  const cb = { SRP: [], '3bet': [], '4bet5bet': [] }; // CB問題 (ポット別, 複数選択)
  const preflop = {};

  for (const variant of variants) {
    const cls = classify(variant);
    if (!cls) continue;
    const { pot, potCat, aggressor, defender } = cls;
    const { oop, aggressorRole } = roles(aggressor, defender);
    preflop[variant] = buildPreflopSeq(variant, loadNode(variant, 'flop_root.json'));

    // CB問題: 全ポット。アグレッサーの c-bet ノード。hero=アグレッサー / villain=ディフェンダー。
    //   アグレッサー OOP→flop_root / IP→flop_<oop>_x (OOP チェック後の局面)。
    const pool = cb[potCat];
    if (pool && pool.length < PER_POT_CAP) {
      const cbFile = aggressorRole === 'OOP' ? 'flop_root.json' : `flop_${oop.toLowerCase()}_x.json`;
      const node = loadNode(variant, cbFile);
      if (node) {
        const flopPot = node.game_point?.game?.pot ?? 0;
        for (const s of node.solutions) {
          if (pool.length >= PER_POT_CAP) break;
          const strat = bucketize(s.action_solutions, flopPot);
          if (!isMixed(strat)) continue; // 中級: 混合戦略ボードのみ
          pool.push({ variant, hero: aggressor, villain: defender, pot, board: s.name, strat });
        }
      }
    }
  }

  const out = {
    config: CONFIG,
    generated_at: new Date().toISOString(),
    note: 'Flop intermediate range-bet. cb = aggressor c-bet size mix by pot (multi-select).',
    cb_choices: CB_CHOICES,
    preflop,
    cb,
  };
  fs.writeFileSync(OUT_FILE, JSON.stringify(out));
  console.log('CB SRP      :', cb.SRP.length);
  console.log('CB 3bet     :', cb['3bet'].length);
  console.log('CB 4bet5bet :', cb['4bet5bet'].length);
  console.log(`Wrote ${path.relative(process.cwd(), OUT_FILE)} (${(fs.statSync(OUT_FILE).size / 1024).toFixed(1)}KB)`);
}

main();
