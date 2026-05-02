#!/usr/bin/env node
// Pre-compute EV ranks (top-pct + tier) for each of the 169 hands.
// Output: src/data/evRanking.ts (TypeScript module, statically importable)
//
// Source: public/data/ev_ranking/ave_ev_100bb.json
//   schema: { scenario, position, action, stack_bb, ev_unit, hands: { "AA": 9.046, ... } }
//   = 5 ポジション (UTG/HJ/CO/BTN/SB) の平均 open EV (bb)
// Run: node scripts/build-ev-tiers.cjs (re-run when source EV data changes)

const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '../public/data/ev_ranking/ave_ev_100bb.json');
const OUT = path.resolve(__dirname, '../src/data/evRanking.ts');

const raw = JSON.parse(fs.readFileSync(SRC, 'utf8'));
// 新スキーマ: hands ラッパ + ev は plain number。
// 旧スキーマ ({ "AA": {ev, combo}, ... }) もフォールバックで受ける。
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

function getTier(ev, topPct) {
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
  r.tier = getTier(r.ev, r.topPct);
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
  "  | 'average' | 'weak' | 'marginal' | 'poor' | 'trash';",
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
