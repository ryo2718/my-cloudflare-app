#!/usr/bin/env node
// middle_vs_open 境界ハンド統計: 自分=BTN/SB が opener (UTG/HJ/CO/BTN) の 2.5BB open に応答するレンジ。
// 条件: tier 表に存在 && 主要戦略 1+ && 単一 100% でない (= isHandEligible 同等)。

const fs = require('fs');
const path = require('path');

const DATA_ROOT = path.resolve(__dirname, '../public/data/preflop/cash_100bb_6max_nl500_2.5x');
const EV_TS = path.resolve(__dirname, '../src/data/evRanking.ts');

function tier() {
  const t = fs.readFileSync(EV_TS, 'utf8');
  const set = new Set();
  const re = /"([A-Za-z0-9]+)":\s*\{[^}]*"tier"/g;
  let m;
  while ((m = re.exec(t)) !== null) set.add(m[1]);
  return set;
}
const TIER = tier();

const PAIRS = [
  // [opener, responder]
  ['UTG', 'BTN'], ['HJ', 'BTN'], ['CO', 'BTN'],
  ['UTG', 'SB'], ['HJ', 'SB'], ['CO', 'SB'], ['BTN', 'SB'],
];

function countMajor(s) {
  return ['allin', 'raise', 'call', 'fold'].filter((k) => (s[k] || 0) >= 20).length;
}

function isEligible(hand, s) {
  if (!TIER.has(hand)) return false;
  const major = countMajor(s);
  if (major < 1) return false;
  if (major === 1) {
    const maxF = Math.max(s.allin || 0, s.raise || 0, s.call || 0, s.fold || 0);
    if (maxF >= 99.999) return false;
  }
  return true;
}

console.log('========================================');
console.log('middle_vs_open 境界ハンドリスト (BTN/SB)');
console.log('========================================');

for (const [op, re] of PAIRS) {
  const fp = path.join(DATA_ROOT, `${op.toLowerCase()}r_${re.toLowerCase()}.json`);
  if (!fs.existsSync(fp)) {
    console.log(`\n[${re} vs ${op} open] FILE NOT FOUND`);
    continue;
  }
  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
  const eligible = Object.entries(data.hands).filter(([h, s]) => isEligible(h, s));
  console.log(`\n[${re} vs ${op} open] eligible: ${eligible.length} ハンド`);
  for (const [h, s] of eligible.slice(0, 20)) {
    console.log(
      `  ${h.padEnd(5)} ai:${String(s.allin ?? 0).padStart(5)} r:${String(s.raise).padStart(5)} c:${String(s.call).padStart(5)} f:${String(s.fold).padStart(5)}`,
    );
  }
  if (eligible.length > 20) console.log(`  ... 他 ${eligible.length - 20} ハンド省略`);
}
