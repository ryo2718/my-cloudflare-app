#!/usr/bin/env node
// Pre-compute EV ranks (top-pct + tier) for each of the 169 hands.
// Output: src/data/evRanking.ts (TypeScript module, statically importable)
//
// Source: public/data/ev_ranking/ave_ev_100bb.json
//   schema: { scenario, position, action, stack_bb, ev_unit, hands: { "AA": 9.046, ... } }
//   = 5 ポジション (UTG/HJ/CO/BTN/SB) の平均 open EV (bb)
// Run: node scripts/build-ev-tiers.cjs (re-run when source EV data changes)
//
// Phase 11 改修: 'garbage' ティアを追加。GARBAGE_HANDS にリストされたハンドは
// top-pct とは独立に最優先で 'garbage' に分類 (= プレイ厳禁)。
// 既存の 'trash' (EV=0) はそのまま、ただし garbage に挙げた hand は trash 表記から外れる。

const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '../public/data/ev_ranking/ave_ev_100bb.json');
const OUT = path.resolve(__dirname, '../src/data/evRanking.ts');

// ----------------------------------------------------------------------------
// "ゴミハンド" 明示リスト (canonical = higher-rank-first)
// ユーザー指定 (Phase 11 訂正版): プレイ厳禁の 38 ハンドに絞り込み。
//   - Offsuit (34): 低位 × 中-高ランク (J6o まで)、コネクター・準コネクター除外
//   - Suited  (4): 72s/82s/92s/83s のみ (74s/85s/94s 等は除外、薄いコンボバリュー残存)
// ----------------------------------------------------------------------------
const GARBAGE_HANDS = new Set([
  // Offsuit (34) — 行ヘッダの「上位カード」順
  // h=3 (1): 32o
  '32o',
  // h=4 (2)
  '42o', '43o',
  // h=5 (2): 54o は除外
  '52o', '53o',
  // h=6 (3): 65o は除外
  '62o', '63o', '64o',
  // h=7 (3): 75o は除外
  '72o', '73o', '74o',
  // h=8 (4): 86o は除外
  '82o', '83o', '84o', '85o',
  // h=9 (4): 96o は除外
  '92o', '93o', '94o', '95o',
  // h=T (4): T6o / T7o は除外
  'T2o', 'T3o', 'T4o', 'T5o',
  // h=J (5): J7o は除外
  'J2o', 'J3o', 'J4o', 'J5o', 'J6o',
  // h=Q (3): Q5o / Q6o / Q7o は除外
  'Q2o', 'Q3o', 'Q4o',
  // h=K (3): K5o / K6o / K7o は除外
  'K2o', 'K3o', 'K4o',

  // Suited (4) — 大ギャップ低位のみ
  '72s', '82s', '92s',  // lower=2
  '83s',                 // lower=3
]);

const raw = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const handsMap = raw.hands ?? raw;

function combosFor(hand) {
  if (hand.length === 2) return 6;            // pair
  if (hand.endsWith('s')) return 4;           // suited
  if (hand.endsWith('o')) return 12;          // offsuit
  return 0;
}

function evOf(val) {
  return typeof val === 'number' ? val : val.ev;
}

// Combo 展開して EV 降順ソート (= 個別の手札の組み合わせ単位で順位付け)
const expanded = [];
for (const [hand, val] of Object.entries(handsMap)) {
  const ev = evOf(val);
  const combo = combosFor(hand);
  for (let i = 0; i < combo; i++) {
    expanded.push({ hand, ev });
  }
}
expanded.sort((a, b) => b.ev - a.ev);
const TOTAL_COMBOS = expanded.length;

// 各ハンドの「最後の combo の位置 (= top-pct の保守的な下端)」
const handRanks = {};
for (const [hand, val] of Object.entries(handsMap)) {
  const ev = evOf(val);
  const combo = combosFor(hand);
  let lastIdx = -1;
  for (let i = expanded.length - 1; i >= 0; i--) {
    if (expanded[i].hand === hand) { lastIdx = i; break; }
  }
  const topPct = ((lastIdx + 1) / TOTAL_COMBOS) * 100;
  handRanks[hand] = {
    ev,
    combo,
    topPct: Number(topPct.toFixed(2)),
  };
}

function getTier(ev, topPct, hand) {
  // garbage は最優先 (EV=0 でなくても、運用上プレイ不可と判定したもの)
  if (GARBAGE_HANDS.has(hand)) return 'garbage';
  if (ev === 0) return 'trash';
  if (topPct <= 2)  return 'premium';
  if (topPct <= 5)  return 'elite';
  if (topPct <= 10) return 'strong';
  if (topPct <= 17) return 'good';
  if (topPct <= 27) return 'standard';
  if (topPct <= 40) return 'average';
  if (topPct <= 50) return 'weak';
  if (topPct <= 58) return 'marginal';
  if (topPct <= 63) return 'poor';
  return 'trash';
}

for (const hand of Object.keys(handRanks)) {
  const r = handRanks[hand];
  r.tier = getTier(r.ev, r.topPct, hand);
}

// 検算: GARBAGE_HANDS の全ハンドが評価データに存在するか
const missing = [...GARBAGE_HANDS].filter((h) => !handRanks[h]);
if (missing.length > 0) {
  throw new Error(`GARBAGE_HANDS includes unknown hand(s): ${missing.join(', ')}`);
}

const tierCounts = {};
for (const r of Object.values(handRanks)) {
  tierCounts[r.tier] = (tierCounts[r.tier] || 0) + 1;
}

const lines = [
  '// AUTO-GENERATED. Do not edit by hand.',
  '// Source: public/data/ev_ranking/ave_ev_100bb.json (5-position averaged open EV)',
  '// Regenerate with:  node scripts/build-ev-tiers.cjs',
  '',
  "export type EvTier =",
  "  | 'premium' | 'elite' | 'strong' | 'good' | 'standard'",
  "  | 'average' | 'weak' | 'marginal' | 'poor' | 'garbage' | 'trash';",
  '',
  'export interface EvRankInfo {',
  '  ev: number;',
  '  combo: number;',
  '  topPct: number;  // 0-100',
  '  tier: EvTier;',
  '}',
  '',
  `export const TOTAL_COMBOS = ${TOTAL_COMBOS};`,
  '',
  'export const EV_RANKING: Readonly<Record<string, EvRankInfo>> = {',
];
for (const hand of Object.keys(handRanks)) {
  lines.push(`  ${JSON.stringify(hand)}: ${JSON.stringify(handRanks[hand])},`);
}
lines.push('};');
lines.push('');

fs.writeFileSync(OUT, lines.join('\n'));
console.log(`Generated ${OUT} (${Object.keys(handRanks).length} hands, total combos: ${TOTAL_COMBOS})`);
console.log('Tier distribution:', tierCounts);
console.log(`Garbage hands explicit list size: ${GARBAGE_HANDS.size}, assigned: ${tierCounts.garbage ?? 0}`);
