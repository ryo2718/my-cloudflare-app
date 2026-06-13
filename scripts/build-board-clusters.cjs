// Board clustering builder (deterministic).
//
// 全フロップ (flop_training_v1 + flop_rangebet_v1 収録ボードの和集合 ≈ 1754 canonical
// フロップ) を、代表ボード (49 + mono/trips 被覆穴用 5 = 54) への「ハイブリッド最近傍」で
// クラスタリングし、public/data/flop/board-clusters.json を生成する。
//
// ハイブリッド最近傍:
//   1. boardCanonicalKey 相当でスート同型正規化 (src/utils/flopBoardCanonical.ts と同一)
//   2. (pairing, suit) でハードバケット一致した代表のみを候補に
//   3. rank L1 距離で最近傍代表へ割当 (候補が無いバケットのみ全代表へソフトフォールバック)
//
// 実行: node scripts/build-board-clusters.cjs  (npm run build:clusters / build から呼ばれる)

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// canonical (src/utils/flopBoardCanonical.ts の isoSignature + boardCanonicalKey 再現)
// ---------------------------------------------------------------------------
const RANKV = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, T: 10, J: 11, Q: 12, K: 13, A: 14 };
const CLS_TO_SUIT = { A: 's', B: 'h', C: 'd', D: 'c' };

function parseBoard(name) {
  return [
    { rank: name[0], suit: name[1] },
    { rank: name[2], suit: name[3] },
    { rank: name[4], suit: name[5] },
  ];
}
function computeSignature(cards) {
  const m = new Map();
  let next = 'A'.charCodeAt(0);
  const classes = [];
  for (const c of cards) {
    let l = m.get(c.suit);
    if (l === undefined) { l = String.fromCharCode(next++); m.set(c.suit, l); }
    classes.push(l);
  }
  return cards.map((c) => c.rank).join('') + '|' + classes.join('');
}
function orderedPerms(cards) {
  const idx = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  return idx
    .map((p) => [cards[p[0]], cards[p[1]], cards[p[2]]])
    .filter((p) => RANKV[p[0].rank] >= RANKV[p[1].rank] && RANKV[p[1].rank] >= RANKV[p[2].rank]);
}
function isoSignature(cards) {
  const sorted = [...cards].sort((a, b) => RANKV[b.rank] - RANKV[a.rank]);
  let best = null;
  for (const p of orderedPerms(sorted)) {
    const s = computeSignature(p);
    if (best === null || s < best) best = s;
  }
  return best;
}
function boardCanonicalKey(name) {
  const sig = isoSignature(parseBoard(name));
  const [ranks, classes] = sig.split('|');
  let r = '';
  for (let i = 0; i < 3; i++) r += ranks[i] + CLS_TO_SUIT[classes[i]];
  return r;
}

// ---------------------------------------------------------------------------
// 特徴量
// ---------------------------------------------------------------------------
function features(canonBoard) {
  const r = [canonBoard[0], canonBoard[2], canonBoard[4]].map((c) => RANKV[c]);
  const s = [canonBoard[1], canonBoard[3], canonBoard[5]];
  const sorted = [...r].sort((a, b) => b - a); // desc
  const nR = new Set(r).size;
  const nS = new Set(s).size;
  const top = sorted[0];
  const pairing = nR === 1 ? 'trips' : nR === 2 ? 'paired' : 'unpaired';
  const suit = nS === 1 ? 'mono' : nS === 2 ? 'two-tone' : 'rainbow';
  const high = top === 14 ? 'A' : top === 13 ? 'K' : top === 12 ? 'Q' : top === 11 ? 'J' : top === 10 ? 'T' : top >= 6 ? 'mid' : 'low';
  let conn = 'paired';
  if (pairing === 'unpaired') {
    const span = sorted[0] - sorted[2];
    conn = span <= 4 ? 'connected' : span <= 8 ? 'gappy' : 'disconnected';
  }
  return { sorted, pairing, suit, high, conn };
}
function label(canonBoard) {
  const f = features(canonBoard);
  return `${f.high} ${f.pairing} ${f.suit}${f.pairing === 'unpaired' ? ' ' + f.conn : ''}`;
}

// ---------------------------------------------------------------------------
// 代表ボード (49 + 被覆穴 5)
// ---------------------------------------------------------------------------
const REPS_49 = [
  '7s3h2d', 'QsJhTd', 'QsTs8s', 'KsTs9h', '9s3s2h', '3h3d2s', 'Qs8s3s', 'As6s6h', 'Ts5h2d', 'KsTsTh',
  'Js5h4d', 'QhQdJs', 'Qs4h2d', 'KsQs2h', 'AsJh7s', '7s7h6s', 'Ts7h5d', 'Ts6h4d', 'AsJs6h', 'AhJsTs',
  'Ts7h6d', 'AsAh7s', 'Ks6s3h', 'Qs7h3d', 'Js8h2s', '9s7s5s', '5s4s4h', '6s4s3s', 'Ah5s2s', 'As4h2d',
  'Qs7h6d', 'AsKs3h', 'KsTh8d', 'AsTh8s', '9h5s3s', 'JsJh9s', 'As9h3d', 'Ks9h7d', 'Ks8h4d', 'QsTh9d',
  '9s8s3h', '8h7s4s', 'KsKh7s', '9s6s2h', 'Js8s8h', 'KhJs4s', 'AsQs5h', '8s6h5d', 'Qs9h8d',
];
// 被覆穴: trips (代表 0) + mono (代表 4 のみ) を補う追加代表。
const REPS_EXTRA = ['5s5h5d', 'KsKhKd', 'AsKsTs', '8s5s2s', 'Ks8s4s'];

// ---------------------------------------------------------------------------
// 全ボード抽出 (canonical 化)
// ---------------------------------------------------------------------------
const ROOT = path.resolve(__dirname, '..');
function loadBoards() {
  const set = new Set();
  const tr = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/flop/flop_training_v1.json')));
  for (const pot of Object.keys(tr.cb || {})) for (const band of Object.keys(tr.cb[pot])) for (const x of tr.cb[pot][band]) set.add(boardCanonicalKey(x.board));
  for (const band of Object.keys(tr.donk || {})) for (const x of tr.donk[band]) set.add(boardCanonicalKey(x.board));
  const rb = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/flop/flop_rangebet_v1.json')));
  for (const cat of Object.keys(rb.cb || {})) for (const x of rb.cb[cat]) set.add(boardCanonicalKey(x.board));
  for (const x of rb.donk || []) set.add(boardCanonicalKey(x.board));
  for (const x of rb.bmcb || []) set.add(boardCanonicalKey(x.board));
  return [...set].sort(); // 決定的順序
}

// ---------------------------------------------------------------------------
// ハイブリッド最近傍分類
// ---------------------------------------------------------------------------
function classify(boards, reps) {
  const repF = reps.map((b, i) => ({ id: i, board: b, f: features(b) }));
  const mapping = {};
  let soft = 0;
  for (const b of boards) {
    const f = features(b);
    const hard = repF.filter((r) => r.f.pairing === f.pairing && r.f.suit === f.suit);
    const pool = hard.length ? hard : repF;
    let best = null;
    let bd = Infinity;
    for (const r of pool) {
      let d = 0;
      for (let i = 0; i < 3; i++) d += Math.abs(f.sorted[i] - r.f.sorted[i]);
      if (!hard.length) {
        d += r.f.pairing !== f.pairing ? 4 : 0;
        d += r.f.suit !== f.suit ? 2 : 0;
      }
      // tie-break: 小さい cluster_id を優先 (決定的)
      if (d < bd || (d === bd && r.id < best.id)) { bd = d; best = r; }
    }
    mapping[b] = best.id;
    if (!hard.length) soft++;
  }
  return { mapping, soft };
}

// ---------------------------------------------------------------------------
// 生成
// ---------------------------------------------------------------------------
function main() {
  const repsRaw = [...REPS_49, ...REPS_EXTRA];
  const reps = repsRaw.map(boardCanonicalKey);
  // 代表に重複が無いこと
  if (new Set(reps).size !== reps.length) throw new Error('representative boards contain duplicates after canonicalization');

  const boards = loadBoards();
  const { mapping, soft } = classify(boards, reps);

  // 不変条件: 各代表は自分自身のクラスタに属する
  reps.forEach((rep, id) => {
    if (mapping[rep] !== id) throw new Error(`representative ${rep} not assigned to its own cluster (${mapping[rep]} != ${id})`);
  });

  // cluster サイズ
  const size = reps.map(() => 0);
  for (const b of boards) size[mapping[b]]++;

  const representatives = reps.map((b, id) => ({ cluster_id: id, board: b, label: label(b), size: size[id] }));

  const out = {
    version: 1,
    generated_at: new Date().toISOString(),
    note: 'Hybrid nearest-rep clustering of all canonical flops. 49 ryoji reps + 5 mono/trips coverage reps = 54.',
    representatives,
    mapping,
  };
  const outPath = path.join(ROOT, 'public/data/flop/board-clusters.json');
  fs.writeFileSync(outPath, JSON.stringify(out));
  const sizes = [...size].sort((a, b) => a - b);
  console.log(`board-clusters.json: ${boards.length} boards -> ${reps.length} clusters`);
  console.log(`  cluster size min/median/max = ${sizes[0]} / ${sizes[(sizes.length / 2) | 0]} / ${sizes[sizes.length - 1]}, soft-fallback = ${soft}`);
  console.log(`  wrote ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(0)} KB)`);
}
main();
