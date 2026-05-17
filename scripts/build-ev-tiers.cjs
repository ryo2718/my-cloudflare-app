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
// ユーザー指定: トラッシュから抜き出し + 同等にプレイ不可な offsuit/suited を集約。
// オフスート (48): 低位カードペア・コネクター以外の弱手をピックアップ
// スーテッド (9): 低位ギャップ系 (suited 即潰し)
// ----------------------------------------------------------------------------
const GARBAGE_HANDS = new Set([
  // Offsuit: lower=2 (11) — all 32o..K2o (A2o は除外)
  '32o', '42o', '52o', '62o', '72o', '82o', '92o', 'T2o', 'J2o', 'Q2o', 'K2o',
  // Offsuit: lower=3 (10) — 43o..K3o
  '43o', '53o', '63o', '73o', '83o', '93o', 'T3o', 'J3o', 'Q3o', 'K3o',
  // Offsuit: lower=4 (9) — 54o..K4o
  '54o', '64o', '74o', '84o', '94o', 'T4o', 'J4o', 'Q4o', 'K4o',
  // Offsuit: lower=5 (8) — 65o..K5o
  '65o', '75o', '85o', '95o', 'T5o', 'J5o', 'Q5o', 'K5o',
  // Offsuit: lower=6 (6) — 86o..K6o (76o はコネクターなので除外)
  '86o', '96o', 'T6o', 'J6o', 'Q6o', 'K6o',
  // Offsuit: lower=7 (4) — T7o..K7o (87o, 97o は除外)
  'T7o', 'J7o', 'Q7o', 'K7o',

  // Suited 大ギャップ低位 (9)
  '72s', '82s', '92s', 'T2s',  // lower=2
  '73s', '83s', '93s',          // lower=3
  '84s', '94s',                 // lower=4
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
