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
const PER_VARIANT_CAP = 120; // variant (matchup) ごとの最大ボード数。全 matchup を均等収録し hero 偏りを防ぐ
const MIXED_MIN = 0.1; // CB「混合戦略」判定: この頻度以上のバケットが2つ以上

// CB問題の選択肢 (全ポット共通の上位集合)。125 = オーバーベット, ALLIN = オールイン。
// 実際に表示する選択肢はポット別 (cb_choices_by_pot) に出し分ける。
const CB_CHOICES = ['check', '33', '50', '75', '125', 'ALLIN'];
// ポット別選択肢の正準順 (check → 小 → 大 → ALLIN)。実データに出現したバケットのみ採用。
const BUCKET_ORDER = ['check', '33', '50', '75', '125', 'ALLIN'];
const POT_ORDER = ['SRP', '3bet', '4bet', '5bet'];
const CHOICE_MIN = 0.02; // この頻度以上で出現したバケットのみ選択肢に出す (微小頻度の幻バケットを除外)

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

/** ノードのゲーム状態から pos の preflop 投入額 (= 100 - 残スタック)。無ければ null。 */
function investedFrom(node, pos) {
  const players = node?.game_point?.game?.players ?? [];
  const p = players.find((x) => x.position === pos);
  return p ? Number((100 - parseFloat(p.current_stack)).toFixed(1)) : null;
}

/**
 * 3bet サイズの参照表 (key=`{opener}>{3bettor}` → bb)。
 * 3bet-call ライン (3bettor の最終投入 = 3bet サイズ) から作る。4bet/5bet ラインでも
 * 3bet サイズは同じ matchup で一定なので、ここを参照して実額を表示する。
 */
function buildThreeBetSizes(variants) {
  const map = {};
  for (const variant of variants) {
    const cls = classify(variant);
    if (!cls || cls.pot !== '3bet') continue; // aggressor=3bettor, defender=opener
    const size = investedFrom(loadNode(variant, 'flop_root.json'), cls.aggressor);
    if (size != null) map[`${cls.defender}>${cls.aggressor}`] = size;
  }
  return map;
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

/** action_code を CB バケット (33/50/75/125) に寄せる。RAI→ALLIN (オールイン)。X はここでは扱わない。 */
function bucketSrp(code, pot) {
  if (code === 'RAI') return 'ALLIN';
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

/** プリフロップ アクション列 (アニメ用)。folds を席順で割り込ませ、raise 額は invested / 3bet表 から決定。 */
function buildPreflopSeq(variant, node, threeBetSizes = {}) {
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
        // 後で再度動く中間レイズ (4bet ライン中の 3bet) は最終 invested から実額が取れないが、
        // 3bet サイズは同 matchup で一定なので 3bet表 から実額を引く。無ければ直前レベルの約3倍で近似。
        const opener = chain[0] ? chain[0].position : null;
        const fromTable = opener ? threeBetSizes[`${opener}>${c.position}`] : null;
        const prevAmt = i > 0 ? chain[i - 1].amount ?? OPEN_SIZE : OPEN_SIZE;
        c.amount = fromTable != null ? fromTable : Number((prevAmt * 3).toFixed(1));
      }
    }
  }
  // チェーン (raise/call の時系列) に各座席の fold を席順で割り込ませる。
  // 降りる席 = chain に出てこない席。オープン前に降りる席は先頭 (= 即表示)、レイザー以降に
  // 降りる席 (例: BTN open に対する SB) はその raise の後に並ぶ。全員先頭 fold だと
  // 「SB が BTN より先に降りる」ように見えるのを防ぐ。
  const inChain = new Set(chain.map((c) => c.position));
  const folded = new Set();
  const seq = [];
  let idx = 0;
  let guard = 0;
  for (let seat = 0; idx < chain.length && guard < 200; seat++, guard++) {
    const pos = POSITIONS[seat % POSITIONS.length];
    if (folded.has(pos)) continue;
    if (chain[idx].position === pos) { seq.push(chain[idx]); idx++; continue; }
    if (inChain.has(pos)) continue; // 参加者は降りない (席順で後で行動 / 既に行動済み)
    folded.add(pos);
    seq.push({ position: pos, kind: 'fold' });
  }
  return seq;
}

/**
 * ポット別の表示選択肢を実データから導出。各ポットで CHOICE_MIN 以上の頻度を持つ
 * バケットだけ採用 (check は常に含む)。例: 4bet は 125 が実在しない→[check,33,50,75,ALLIN]、
 * 5bet は 75/125 も無い→[check,33,50,ALLIN]。SRP/3bet は 125 オーバーベットが実在。
 */
function computeChoicesByPot(cb) {
  const present = {};
  for (const pool of Object.values(cb)) {
    for (const b of pool) {
      const set = present[b.pot] ?? (present[b.pot] = new Set());
      for (const [k, v] of Object.entries(b.strat)) if (v >= CHOICE_MIN) set.add(k);
    }
  }
  const out = {};
  for (const pot of POT_ORDER) {
    const set = present[pot];
    if (!set) continue;
    out[pot] = BUCKET_ORDER.filter((k) => k === 'check' || set.has(k));
  }
  return out;
}

function main() {
  if (!fs.existsSync(DATA_ROOT)) {
    console.error(`Missing flop tree data: ${DATA_ROOT} (R2 mirror 必要)`);
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const variants = fs.readdirSync(DATA_ROOT).filter((d) => fs.statSync(path.join(DATA_ROOT, d)).isDirectory());
  const threeBetSizes = buildThreeBetSizes(variants); // 4bet ライン中の 3bet 実額参照用

  const cb = { SRP: [], '3bet': [], '4bet5bet': [] }; // CB問題 (ポット別, 複数選択)
  const preflop = {};

  for (const variant of variants) {
    const cls = classify(variant);
    if (!cls) continue;
    const { pot, potCat, aggressor, defender } = cls;
    const { oop, aggressorRole } = roles(aggressor, defender);
    preflop[variant] = buildPreflopSeq(variant, loadNode(variant, 'flop_root.json'), threeBetSizes);

    // CB問題: 全ポット。アグレッサーの c-bet ノード。hero=アグレッサー / villain=ディフェンダー。
    //   アグレッサー OOP→flop_root / IP→flop_<oop>_x (OOP チェック後の局面)。
    const pool = cb[potCat];
    if (pool) {
      const cbFile = aggressorRole === 'OOP' ? 'flop_root.json' : `flop_${oop.toLowerCase()}_x.json`;
      const node = loadNode(variant, cbFile);
      if (node) {
        const flopPot = node.game_point?.game?.pot ?? 0;
        let added = 0; // この variant からの収録数 (matchup ごとに上限 → 全 matchup を均等収録)
        for (const s of node.solutions) {
          if (added >= PER_VARIANT_CAP) break;
          const strat = bucketize(s.action_solutions, flopPot);
          if (!isMixed(strat)) continue; // 中級: 混合戦略ボードのみ
          pool.push({ variant, hero: aggressor, villain: defender, pot, board: s.name, strat });
          added++;
        }
      }
    }
  }

  const cbChoicesByPot = computeChoicesByPot(cb);

  const out = {
    config: CONFIG,
    generated_at: new Date().toISOString(),
    note: 'Flop range-bet. cb = aggressor c-bet size mix by pot (multi-select). RAI=ALLIN.',
    cb_choices: CB_CHOICES,
    cb_choices_by_pot: cbChoicesByPot,
    preflop,
    cb,
  };
  fs.writeFileSync(OUT_FILE, JSON.stringify(out));
  console.log('CB SRP      :', cb.SRP.length);
  console.log('CB 3bet     :', cb['3bet'].length);
  console.log('CB 4bet5bet :', cb['4bet5bet'].length, '(4bet/5bet)');
  console.log('choices/pot :', JSON.stringify(cbChoicesByPot));
  console.log(`Wrote ${path.relative(process.cwd(), OUT_FILE)} (${(fs.statSync(OUT_FILE).size / 1024).toFixed(1)}KB)`);
}

main();
