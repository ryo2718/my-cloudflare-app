#!/usr/bin/env node
// 各 (シナリオ, ポジ, ティア) で初級出題可能なハンド数を集計。
// 出題対象 = fold < 0.1% または fold > 99.9% (混合戦略を除外)。

const fs = require('fs');
const path = require('path');

const DATA_ROOT = path.resolve(__dirname, '../public/data/preflop/cash_100bb_6max_nl500_2.5x');
const EV_RANKING_TS = path.resolve(__dirname, '../src/data/evRanking.ts');
const EPSILON = 0.1;

// EV_RANKING を簡易パース (`"AA": {"ev":...,"tier":"premium"}`)
function parseEvRanking() {
  const txt = fs.readFileSync(EV_RANKING_TS, 'utf8');
  const map = {};
  const re = /"([A-Za-z0-9]+)":\s*\{[^}]*"tier":"([a-z]+)"/g;
  let m;
  while ((m = re.exec(txt)) !== null) {
    map[m[1]] = m[2];
  }
  return map;
}

function loadJson(filename) {
  const p = path.join(DATA_ROOT, filename);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function isEligible(strategy) {
  if (!strategy) return true; // undefined = 実質 100% fold
  const fold = strategy.fold ?? 0;
  return fold < EPSILON || fold > 100 - EPSILON;
}

function classifyEligible(strategy) {
  if (!strategy) return 'fold';
  const fold = strategy.fold ?? 0;
  if (fold < EPSILON) return 'participate';
  if (fold > 100 - EPSILON) return 'fold';
  return 'mixed';
}

const TIER_OF = parseEvRanking();
const OPEN_POSITIONS = ['UTG', 'HJ', 'CO', 'BTN', 'SB'];
const OPEN_TIER_RANGES = {
  UTG: ['elite', 'strong', 'good', 'standard', 'average', 'weak', 'marginal', 'poor'],
  HJ:  ['elite', 'strong', 'good', 'standard', 'average', 'weak', 'marginal', 'poor'],
  CO:  ['strong', 'good', 'standard', 'average', 'weak', 'marginal', 'poor'],
  BTN: ['good', 'standard', 'average', 'weak', 'marginal', 'poor', 'trash'],
  SB:  ['standard', 'average', 'weak', 'marginal', 'poor', 'trash', 'garbage'],
};
const VS_OPEN_RESPONDERS = ['HJ', 'CO', 'BTN', 'SB', 'BB'];
const VS_OPEN_TIER_RANGES = {
  HJ:  ['elite', 'strong', 'good', 'standard'],
  CO:  ['elite', 'strong', 'good', 'standard'],
  BTN: ['premium', 'elite', 'strong', 'good', 'standard', 'average'],
  SB:  ['premium', 'elite', 'strong', 'good', 'standard', 'average', 'weak'],
  BB:  ['standard', 'average', 'weak', 'marginal', 'poor', 'trash', 'garbage'],
};
const ORDER = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];

// (シナリオ, position, tier) → eligible count
function countByTier(hands, allowedTiers) {
  const result = {};
  for (const tier of allowedTiers) result[tier] = { eligible: 0, mixed: 0, total: 0 };
  for (const [hand, info] of Object.entries(TIER_OF)) {
    if (!allowedTiers.includes(info)) continue;
    result[info].total++;
    const s = hands[hand];
    const cls = classifyEligible(s);
    if (cls === 'mixed') result[info].mixed++;
    else result[info].eligible++;
  }
  return result;
}

console.log('==================================================');
console.log('OPEN SCENARIO (前半 10 問)');
console.log('==================================================');
for (const pos of OPEN_POSITIONS) {
  const file = `${pos.toLowerCase()}.json`;
  const data = loadJson(file);
  if (!data) {
    console.log(`${pos}: file not found (${file})`);
    continue;
  }
  const breakdown = countByTier(data.hands, OPEN_TIER_RANGES[pos]);
  const totalElig = Object.values(breakdown).reduce((s, v) => s + v.eligible, 0);
  const totalMixed = Object.values(breakdown).reduce((s, v) => s + v.mixed, 0);
  const totalAll = Object.values(breakdown).reduce((s, v) => s + v.total, 0);
  console.log(`\n[${pos}] tiers=[${OPEN_TIER_RANGES[pos].join(',')}]  total=${totalAll}  eligible=${totalElig}  mixed=${totalMixed}`);
  for (const [tier, v] of Object.entries(breakdown)) {
    const zeroFlag = v.eligible === 0 ? '  ⚠ ZERO ELIGIBLE' : '';
    console.log(`  ${tier.padEnd(10)} eligible=${v.eligible.toString().padStart(3)} / total=${v.total}  (mixed=${v.mixed})${zeroFlag}`);
  }
}

console.log('\n\n==================================================');
console.log('VS_OPEN SCENARIO (後半 10 問)');
console.log('==================================================');
const VS_OPEN_PAIRS = [];
for (let oi = 0; oi < ORDER.length; oi++) {
  const opener = ORDER[oi];
  if (!OPEN_POSITIONS.includes(opener)) continue;
  for (let ri = oi + 1; ri < ORDER.length; ri++) {
    const responder = ORDER[ri];
    if (!VS_OPEN_RESPONDERS.includes(responder)) continue;
    VS_OPEN_PAIRS.push([opener, responder]);
  }
}

// responder 単位で集計 (responder の tier 範囲を使う)
for (const responder of VS_OPEN_RESPONDERS) {
  const pairs = VS_OPEN_PAIRS.filter(([, r]) => r === responder);
  console.log(`\n[responder=${responder}] tiers=[${VS_OPEN_TIER_RANGES[responder].join(',')}]`);
  for (const [opener, r] of pairs) {
    const file = `${opener.toLowerCase()}r_${r.toLowerCase()}.json`;
    const data = loadJson(file);
    if (!data) {
      console.log(`  vs ${opener.padEnd(3)} open: file not found (${file})`);
      continue;
    }
    const breakdown = countByTier(data.hands, VS_OPEN_TIER_RANGES[responder]);
    const totalElig = Object.values(breakdown).reduce((s, v) => s + v.eligible, 0);
    const totalMixed = Object.values(breakdown).reduce((s, v) => s + v.mixed, 0);
    const totalAll = Object.values(breakdown).reduce((s, v) => s + v.total, 0);
    console.log(`  vs ${opener.padEnd(3)} open  total=${totalAll}  eligible=${totalElig}  mixed=${totalMixed}`);
    const zeroTiers = Object.entries(breakdown).filter(([, v]) => v.eligible === 0).map(([t]) => t);
    if (zeroTiers.length > 0) console.log(`    ⚠ zero-eligible tiers: ${zeroTiers.join(',')}`);
  }
}

console.log('\n==================================================');
console.log('SUMMARY');
console.log('==================================================');
let totalSlots = 0;
let zeroSlots = 0;
for (const pos of OPEN_POSITIONS) {
  const data = loadJson(`${pos.toLowerCase()}.json`);
  if (!data) continue;
  for (const tier of OPEN_TIER_RANGES[pos]) {
    totalSlots++;
    const breakdown = countByTier(data.hands, [tier]);
    if (breakdown[tier].eligible === 0) zeroSlots++;
  }
}
for (const [o, r] of VS_OPEN_PAIRS) {
  const data = loadJson(`${o.toLowerCase()}r_${r.toLowerCase()}.json`);
  if (!data) continue;
  for (const tier of VS_OPEN_TIER_RANGES[r]) {
    totalSlots++;
    const breakdown = countByTier(data.hands, [tier]);
    if (breakdown[tier].eligible === 0) zeroSlots++;
  }
}
console.log(`(scenario × position × tier) slots: ${totalSlots}`);
console.log(`  zero-eligible slots (出題不可): ${zeroSlots}`);
console.log(`  zero-eligible rate: ${(zeroSlots / totalSlots * 100).toFixed(1)}%`);
