#!/usr/bin/env node
// フロップトレーニング中級「個別ハンド戦略」用データセットを生成。
// 「この盤面で QQ ならどうする?(チェック/33/50/75/125)」のような per-hand 出題に使う。
//
// 入力 (webscraping から持ってきた per-hand 戦略):
//   <SRC>/by_chain/<chain>/<board>.json.gz
//   各ファイルは flop-root ノード = 「最初に動く側(=OOP)の per-hand 戦略」。
//   hands{XX:{actions:{X,R..},range_weight,...}} を 169 ハンドクラス分持つ。
//
// 抽出対象: SRP / 3bet / 4bet の flop-root を全部 (LIMP のみ除外)。各ノードに decision を付与:
//   decision:"cbet" = アグレッサー(最後のプリフロップ再レイズ者)が OOP で先手 → Cベットが読める。
//   decision:"lead" = コーラー(ディフェンダー)が OOP で先手 → リード/ドンク戦略 (ほぼチェック)。
//   どちらも hero = フロップ先手(OOP)で、hands はその hero 視点の戦略。
//
// 出力: public/data/flop/flop_perhand_v1.json
//   各ハンドのアクションを check/33/50/75/125 (= %pot) の 5 バケットに集約 (整数%、末尾0は省略)。
//
// 使い方: node scripts/build-flop-perhand.cjs [--cap N] [--src PATH]
//   --cap N : 1 ノードあたりの最大ボード数 (既定 40)。0 で全 184 ボード。

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ---- paths / params ----
const args = process.argv.slice(2);
const getArg = (flag, def) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] != null ? args[i + 1] : def;
};
const DEFAULT_SRC =
  '/Users/shirairyouitaru/pokerprojects/webscraping/gtowizard/output/flop_root_nl500_gto/by_chain';
const SRC = path.resolve(getArg('--src', DEFAULT_SRC));
const BOARDS_PER_NODE = parseInt(getArg('--cap', '40'), 10);
const CONFIG = 'cash_100bb_6max_nl500_2.5x';
const OUT_DIR = path.resolve(__dirname, '..', 'public', 'data', 'flop');
const OUT_FILE = path.join(OUT_DIR, 'flop_perhand_v1.json');

const PRE_ORDER = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']; // preflop action order
const POST_ORDER = ['SB', 'BB', 'UTG', 'HJ', 'CO', 'BTN']; // postflop: earlier = OOP
const SCN_MAP = { SRP: 'SRP', '3BP': '3bet', '4BP': '4bet' };
const BUCKETS = ['check', '33', '50', '75', '125']; // %pot anchors (125 = large/overbet/jam)
const BET_ANCHORS = [33, 50, 75, 125];

// ---- canonical 169 hand-class order (A..2; pairs, suited, offsuit) ----
const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
function buildHandOrder() {
  const out = [];
  for (let i = 0; i < RANKS.length; i++) {
    for (let j = 0; j < RANKS.length; j++) {
      if (i === j) out.push(RANKS[i] + RANKS[j]);
      else if (i < j) out.push(RANKS[i] + RANKS[j] + 's');
      else out.push(RANKS[j] + RANKS[i] + 'o');
    }
  }
  // de-dup while preserving first occurrence (suited/offsuit already unique)
  return [...new Set(out)];
}
const HAND_ORDER = buildHandOrder();

// ---- preflop simulator: chain -> { active, aggressor, flopTokens, seq } ----
function parseSize(tok) {
  return tok === 'RAI' ? 100.0 : parseFloat(tok.slice(1));
}
function simulate(chain) {
  const toks = chain.split('-');
  const contrib = { SB: 0.5, BB: 1.0, UTG: 0, HJ: 0, CO: 0, BTN: 0 };
  const folded = new Set();
  let currentBet = 1.0;
  let aggressor = 'BB';
  const seq = []; // action-order log for animation: {position, kind, amount?}
  const queue = [...PRE_ORDER];
  let i = 0;
  while (queue.length && i < toks.length) {
    const actor = queue.shift();
    if (folded.has(actor)) continue;
    const tok = toks[i++];
    if (tok === 'F') {
      folded.add(actor);
      seq.push({ position: actor, kind: 'fold' });
    } else if (tok === 'C') {
      contrib[actor] = currentBet;
      seq.push({ position: actor, kind: 'call' });
    } else if (tok === 'X') {
      seq.push({ position: actor, kind: 'check' });
    } else if (tok[0] === 'R' || tok === 'RAI') {
      const size = parseSize(tok);
      currentBet = size;
      contrib[actor] = size;
      aggressor = actor;
      seq.push({ position: actor, kind: 'raise', amount: size });
      const inq = new Set(queue);
      for (const p of PRE_ORDER) {
        if (p !== actor && !folded.has(p) && !inq.has(p)) queue.push(p);
      }
    } else {
      return null;
    }
  }
  const active = PRE_ORDER.filter((p) => !folded.has(p));
  const flopTokens = toks.slice(i);
  return { active, aggressor, flopTokens, seq };
}

/** chain が HU flop-root なら {decision,hero,villain,aggressor,opener,label,seq} を返す (LIMP/それ以外は null)。 */
function classifyNode(chain, meta) {
  const sim = simulate(chain);
  if (!sim || sim.active.length !== 2) return null;
  if (sim.flopTokens.length !== 0) return null; // flop-root のみ (継続ノードは無い想定)
  const [a, b] = sim.active;
  const oop = POST_ORDER.indexOf(a) < POST_ORDER.indexOf(b) ? a : b; // 先手 = hero
  const ip = oop === a ? b : a;
  const aggressor = sim.aggressor;
  const caller = aggressor === a ? b : a; // 非アグレッサー = コーラー側
  const decision = aggressor === oop ? 'cbet' : 'lead';
  return {
    decision,
    hero: oop, // フロップ先手 (= hands の主体)
    villain: ip,
    aggressor,
    opener: meta.opener,
    label: `${aggressor} vs ${caller}`, // レイザー vs コーラー
    seq: sim.seq,
  };
}

// ---- bucketing ----
function nearestAnchor(pct) {
  let best = BET_ANCHORS[0];
  let bestD = Infinity;
  for (const v of BET_ANCHORS) {
    const d = Math.abs(pct - v);
    if (d < bestD || (d === bestD && v > best)) {
      best = v;
      bestD = d;
    }
  }
  return BET_ANCHORS.indexOf(best) + 1; // bucket index (0 = check)
}
/** actionsLegend: {code:{betsize}}, pot(number) を使って actions(percent) を 5 バケットへ。 */
function bucketize(actions, legend, pot) {
  const out = [0, 0, 0, 0, 0];
  for (const [code, pct] of Object.entries(actions)) {
    if (!pct) continue;
    if (code === 'X') {
      out[0] += pct;
      continue;
    }
    let size;
    if (code === 'RAI') size = pot; // jam ~ overbet
    else if (legend[code]) size = parseFloat(legend[code].betsize);
    else size = parseFloat(code.slice(1));
    if (!Number.isFinite(size) || !pot) continue;
    out[nearestAnchor(Math.round((size / pot) * 100))] += pct;
  }
  // 整数% に丸め、末尾 0 を省略
  const rounded = out.map((v) => Math.round(v));
  let last = rounded.length - 1;
  while (last > 0 && rounded[last] === 0) last--;
  return rounded.slice(0, last + 1);
}

function evenSample(arr, n) {
  if (n <= 0 || arr.length <= n) return arr;
  const out = [];
  const step = arr.length / n;
  for (let k = 0; k < n; k++) out.push(arr[Math.floor(k * step)]);
  return out;
}

function readGz(fp) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(fp)).toString('utf8'));
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`Missing per-hand source: ${SRC}`);
    console.error('webscraping の flop_root_nl500_gto/by_chain を指してください (--src で上書き可)');
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const chains = fs
    .readdirSync(SRC)
    .filter((d) => fs.statSync(path.join(SRC, d)).isDirectory());

  const nodes = [];
  const stat = { SRP: { cbet: 0, lead: 0 }, '3bet': { cbet: 0, lead: 0 }, '4bet': { cbet: 0, lead: 0 } };
  let totalBoards = 0;

  for (const chain of chains.sort()) {
    const dir = path.join(SRC, chain);
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json.gz'));
    if (!files.length) continue;
    const first = readGz(path.join(dir, files[0]));
    const meta = first._meta || {};
    const pot = SCN_MAP[meta.scenario];
    if (!pot) continue; // LIMP / その他は対象外
    const cls = classifyNode(chain, meta);
    if (!cls) continue; // HU flop-root のみ

    const picked = evenSample(files.sort(), BOARDS_PER_NODE);
    const boards = [];
    for (const f of picked) {
      const d = f === files[0] ? first : readGz(path.join(dir, f));
      const flopPot = parseFloat(d.game_info?.pot);
      const legend = d.actions_legend || {};
      const hands = {};
      for (const [hand, h] of Object.entries(d.hands || {})) {
        const bk = bucketize(h.actions || {}, legend, flopPot);
        // weight (range_weight: そのハンドをどれくらいの頻度で持つか) を整数千分率で
        hands[hand] = { s: bk, w: Math.round((h.range_weight || 0) * 1000) };
      }
      boards.push({ board: d._meta.board, pot: Number(flopPot.toFixed(1)), hands });
    }
    nodes.push({
      scenario: pot,
      label: cls.label, // 例 "BTN vs BB" (レイザー vs コーラー)
      opener: cls.opener,
      hero: cls.hero, // フロップ先手 (OOP)。hands はこの hero 視点
      villain: cls.villain,
      aggressor: cls.aggressor,
      heroRole: 'OOP',
      decision: cls.decision, // 'cbet' (hero=アグレッサー) | 'lead' (hero=ディフェンダー)
      chain,
      preflop: cls.seq,
      boards,
    });
    stat[pot][cls.decision]++;
    totalBoards += boards.length;
  }

  const out = {
    config: CONFIG,
    generated_at: new Date().toISOString(),
    source: 'gtowizard flop_root_nl500_gto (per-hand strategy, 184-board sample)',
    note:
      'Per-hand flop strategy for intermediate "this board + QQ -> ?" quizzes. ' +
      'HU flop-roots for SRP/3bet/4bet. decision="cbet" = hero is the OOP aggressor (real c-bet mix); ' +
      'decision="lead" = hero is the OOP caller (lead/donk strategy, mostly check). ' +
      'hands[XX].s = [check,33,50,75,125] integer %% (trailing zeros trimmed; 125 includes overbet/jam). ' +
      'hands[XX].w = range weight (permille).',
    buckets: BUCKETS,
    hand_order: HAND_ORDER,
    nodes,
  };
  fs.writeFileSync(OUT_FILE, JSON.stringify(out));
  const kb = (fs.statSync(OUT_FILE).size / 1024).toFixed(0);
  const fmt = (s) => `cbet=${s.cbet} lead=${s.lead}`;
  console.log(`nodes: SRP[${fmt(stat.SRP)}] 3bet[${fmt(stat['3bet'])}] 4bet[${fmt(stat['4bet'])}] (total ${nodes.length})`);
  console.log(`board-entries: ${totalBoards}, cap/node: ${BOARDS_PER_NODE || 'all'}`);
  console.log(`Wrote ${path.relative(process.cwd(), OUT_FILE)} (${kb} KB)`);
}

main();
