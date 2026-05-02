#!/usr/bin/env node
// Pre-compute EV ranks (top-pct + tier) for each of the 169 hands.
// Output: src/data/evRanking.ts (TypeScript module, statically importable)
//
// Source: public/data/ev_ranking/utg_open_ev_100bb.json
// Run: node scripts/build-ev-tiers.cjs (re-run when source EV data changes)

const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '../public/data/ev_ranking/utg_open_ev_100bb.json');
const OUT = path.resolve(__dirname, '../src/data/evRanking.ts');

const data = JSON.parse(fs.readFileSync(SRC, 'utf8'));

// Combo 展開して EV 降順ソート (= 個別の手札の組み合わせ単位で順位付け)
const expanded = [];
for (const [hand, val] of Object.entries(data)) {
  for (let i = 0; i < val.combo; i++) {
    expanded.push({ hand, ev: val.ev });
  }
}
expanded.sort((a, b) => b.ev - a.ev);
const TOTAL_COMBOS = expanded.length;

// 各ハンドの「最後の combo の位置 (= top-pct の保守的な下端)」
const handRanks = {};
for (const [hand, val] of Object.entries(data)) {
  let lastIdx = -1;
  for (let i = expanded.length - 1; i >= 0; i--) {
    if (expanded[i].hand === hand) { lastIdx = i; break; }
  }
  const topPct = ((lastIdx + 1) / TOTAL_COMBOS) * 100;
  handRanks[hand] = {
    ev: val.ev,
    combo: val.combo,
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
  '// Source: public/data/ev_ranking/utg_open_ev_100bb.json',
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
