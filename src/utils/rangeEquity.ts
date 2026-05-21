// レンジ (複数コンボ) 同士 / レンジ vs 具体ハンドのエクイティ計算。
//
// 各サイドをコンボ集合 (カード整数のペア配列) で表し、A×B の全ペアについて
// 勝敗を出して「有効ペアのエクイティの平均 (ペア等重み)」を返す。
//   - ブロッカー: 互いに or ボードとカードを共有するペア/コンボはスキップ
//
// 計算方式の自動切替:
//   想定 evaluate7 呼び出し回数 = (|A|×|B|) × ボード補完数 × 2 を試算し、
//   BUDGET 以下なら全列挙 (正確値)、超えるならモンテカルロ (サンプリング)。
//   BUDGET は単一プリフロップ対決 (約340万 calls) が数百ms で終わる実測から、
//   約3秒に収まる 2500万 calls に設定。

import { evaluate7 } from './handEvaluator';

export interface RangeEquityResult {
  /** Player A の平均エクイティ (%)。 */
  a: number;
  /** Player B の平均エクイティ (%)。 */
  b: number;
  /** 引き分け割合 (%)。 */
  tie: number;
  /** 採用した計算方式。 */
  method: 'enumerate' | 'montecarlo';
  /** 有効コンボペア数 (montecarlo は上限見積り)。 */
  pairs: number;
  /** montecarlo のサンプル数 (enumerate は 0)。 */
  samples: number;
}

const BUDGET_EVAL = 25_000_000;
const MC_SAMPLES = 200_000;

type Combo = readonly [number, number];

/** ボード長ごとの未確定ボード補完数の概算 (試算用)。 */
function completionsFor(boardLen: number): number {
  if (boardLen === 0) return 1_712_304; // C(48,5)
  if (boardLen === 3) return 990; // C(45,2)
  if (boardLen === 4) return 44;
  return 1; // 5
}

export function computeRangeEquity(
  aCombos: ReadonlyArray<Combo>,
  bCombos: ReadonlyArray<Combo>,
  board: ReadonlyArray<number>,
): RangeEquityResult {
  const boardSet = new Set(board);
  // ボードとカードを共有するコンボは全ペアで無効なので事前に除外。
  const aF = aCombos.filter(([x, y]) => !boardSet.has(x) && !boardSet.has(y));
  const bF = bCombos.filter(([x, y]) => !boardSet.has(x) && !boardSet.has(y));

  const need = 5 - board.length;
  const estEval = aF.length * bF.length * completionsFor(board.length) * 2;

  return estEval <= BUDGET_EVAL
    ? enumerateRange(aF, bF, board, need)
    : monteCarloRange(aF, bF, board, need);
}

function conflict(ca: Combo, cb: Combo): boolean {
  return ca[0] === cb[0] || ca[0] === cb[1] || ca[1] === cb[0] || ca[1] === cb[1];
}

/** 1 ペアのボード補完を全列挙して勝敗カウント。 */
function countMatchup(
  ca: Combo,
  cb: Combo,
  board: ReadonlyArray<number>,
  deck: number[],
  need: number,
): [number, number, number] {
  const a0 = ca[0];
  const a1 = ca[1];
  const x0 = cb[0];
  const x1 = cb[1];
  let wa = 0;
  let wb = 0;
  let t = 0;
  const n = deck.length;
  const tally = (c0: number, c1: number, c2: number, c3: number, c4: number) => {
    const sa = evaluate7(a0, a1, c0, c1, c2, c3, c4);
    const sb = evaluate7(x0, x1, c0, c1, c2, c3, c4);
    if (sa > sb) wa++;
    else if (sb > sa) wb++;
    else t++;
  };
  if (need === 0) {
    tally(board[0], board[1], board[2], board[3], board[4]);
  } else if (need === 1) {
    for (let i = 0; i < n; i++) tally(board[0], board[1], board[2], board[3], deck[i]);
  } else if (need === 2) {
    for (let i = 0; i < n - 1; i++)
      for (let j = i + 1; j < n; j++) tally(board[0], board[1], board[2], deck[i], deck[j]);
  } else {
    // need === 5 (プリフロップ)。
    for (let i = 0; i < n - 4; i++)
      for (let j = i + 1; j < n - 3; j++)
        for (let k = j + 1; k < n - 2; k++)
          for (let l = k + 1; l < n - 1; l++)
            for (let m = l + 1; m < n; m++) tally(deck[i], deck[j], deck[k], deck[l], deck[m]);
  }
  return [wa, wb, t];
}

function enumerateRange(
  aF: ReadonlyArray<Combo>,
  bF: ReadonlyArray<Combo>,
  board: ReadonlyArray<number>,
  need: number,
): RangeEquityResult {
  let sumA = 0;
  let sumB = 0;
  let sumTie = 0;
  let pairs = 0;
  for (const ca of aF) {
    for (const cb of bF) {
      if (conflict(ca, cb)) continue;
      const dead = new Set<number>([ca[0], ca[1], cb[0], cb[1]]);
      for (const x of board) dead.add(x);
      const deck: number[] = [];
      for (let c = 0; c < 52; c++) if (!dead.has(c)) deck.push(c);
      const [wa, wb, t] = countMatchup(ca, cb, board, deck, need);
      const tot = wa + wb + t;
      if (tot > 0) {
        sumA += (wa + t / 2) / tot;
        sumB += (wb + t / 2) / tot;
        sumTie += t / tot;
        pairs++;
      }
    }
  }
  if (pairs === 0) return { a: 0, b: 0, tie: 0, method: 'enumerate', pairs: 0, samples: 0 };
  return {
    a: (sumA / pairs) * 100,
    b: (sumB / pairs) * 100,
    tie: (sumTie / pairs) * 100,
    method: 'enumerate',
    pairs,
    samples: 0,
  };
}

function monteCarloRange(
  aF: ReadonlyArray<Combo>,
  bF: ReadonlyArray<Combo>,
  board: ReadonlyArray<number>,
  need: number,
): RangeEquityResult {
  const bl = board.length;
  let wa = 0;
  let wb = 0;
  let t = 0;
  let samples = 0;
  let attempts = 0;
  const maxAttempts = MC_SAMPLES * 20;
  const comm = [board[0], board[1], board[2], board[3], board[4]];
  const used = new Set<number>();

  while (samples < MC_SAMPLES && attempts < maxAttempts) {
    attempts++;
    const ca = aF[(Math.random() * aF.length) | 0];
    const cb = bF[(Math.random() * bF.length) | 0];
    if (conflict(ca, cb)) continue;

    used.clear();
    used.add(ca[0]);
    used.add(ca[1]);
    used.add(cb[0]);
    used.add(cb[1]);
    for (const x of board) used.add(x);

    let ok = true;
    for (let d = 0; d < need; d++) {
      let card: number;
      let guard = 0;
      do {
        card = (Math.random() * 52) | 0;
        guard++;
      } while (used.has(card) && guard < 200);
      if (used.has(card)) {
        ok = false;
        break;
      }
      used.add(card);
      comm[bl + d] = card;
    }
    if (!ok) continue;

    const sa = evaluate7(ca[0], ca[1], comm[0], comm[1], comm[2], comm[3], comm[4]);
    const sb = evaluate7(cb[0], cb[1], comm[0], comm[1], comm[2], comm[3], comm[4]);
    if (sa > sb) wa++;
    else if (sb > sa) wb++;
    else t++;
    samples++;
  }

  const pairs = aF.length * bF.length;
  if (samples === 0) return { a: 0, b: 0, tie: 0, method: 'montecarlo', pairs, samples: 0 };
  return {
    a: ((wa + t / 2) / samples) * 100,
    b: ((wb + t / 2) / samples) * 100,
    tie: (t / samples) * 100,
    method: 'montecarlo',
    pairs,
    samples,
  };
}
