#!/usr/bin/env node
// 中級トレーニングのフィルタ条件で eligible なハンド数を集計。
// 出題対象 = ティア表に存在 && 主要戦略 1-3 個 && 1 個の場合は <100%

const fs = require('fs');
const path = require('path');

const DATA_ROOT = path.resolve(__dirname, '../public/data/preflop/cash_100bb_6max_nl500_2.5x');
const EV_RANKING_TS = path.resolve(__dirname, '../src/data/evRanking.ts');
const MAJOR_THRESHOLD = 20;

function parseEvRanking() {
  const txt = fs.readFileSync(EV_RANKING_TS, 'utf8');
  const set = new Set();
  const re = /"([A-Za-z0-9]+)":\s*\{[^}]*"tier"/g;
  let m;
  while ((m = re.exec(txt)) !== null) set.add(m[1]);
  return set;
}

const TIER_HANDS = parseEvRanking();
const OPENERS = ['UTG', 'HJ', 'CO', 'BTN', 'SB'];

function countMajor(s) {
  return ['allin', 'raise', 'call', 'fold'].filter((k) => (s[k] ?? 0) >= MAJOR_THRESHOLD).length;
}

function isEligible(hand, s) {
  if (!TIER_HANDS.has(hand)) return false;
  const major = countMajor(s);
  if (major < 1) return false;
  if (major === 1) {
    const maxFreq = Math.max(s.allin || 0, s.raise || 0, s.call || 0, s.fold || 0);
    if (maxFreq >= 99.999) return false;
  }
  return true;
}

function isMonotonic(handsMap) {
  const entries = Object.entries(handsMap);
  if (entries.length === 0) return true;
  const [, first] = entries[0];
  for (let i = 1; i < entries.length; i++) {
    const [, s] = entries[i];
    for (const k of ['allin', 'raise', 'call', 'fold']) {
      if (Math.abs((s[k] || 0) - (first[k] || 0)) > 0.001) return false;
    }
  }
  return true;
}

console.log('==================================================');
console.log('INTERMEDIATE FILTER: vs open BB 応答');
console.log('==================================================');

let totalEligibleSlots = 0;
const perOpener = {};

for (const op of OPENERS) {
  const file = `${op.toLowerCase()}r_bb.json`;
  const fp = path.join(DATA_ROOT, file);
  if (!fs.existsSync(fp)) {
    console.log(`${op}: file not found`);
    continue;
  }
  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
  const hands = data.hands;

  const mono = isMonotonic(hands);
  let eligibleCount = 0;
  let inTierCount = 0;
  let notInTier = 0;
  let noMajor = 0;
  let pure100 = 0;
  const eligibleByMajor = { 1: 0, 2: 0, 3: 0, 4: 0 };

  for (const [hand, s] of Object.entries(hands)) {
    if (!TIER_HANDS.has(hand)) {
      notInTier++;
      continue;
    }
    inTierCount++;
    const major = countMajor(s);
    if (major < 1) {
      noMajor++;
      continue;
    }
    if (major === 1) {
      const maxFreq = Math.max(s.allin || 0, s.raise || 0, s.call || 0, s.fold || 0);
      if (maxFreq >= 99.999) {
        pure100++;
        continue;
      }
    }
    eligibleCount++;
    eligibleByMajor[major]++;
  }

  perOpener[op] = { mono, eligibleCount, inTierCount, notInTier, noMajor, pure100, eligibleByMajor };

  console.log(`\n[opener=${op}]  monotonic=${mono}`);
  console.log(`  total hands: 169 (in-tier: ${inTierCount} / not-in-tier: ${notInTier})`);
  console.log(`  excluded: noMajor=${noMajor}, pure100%=${pure100}`);
  console.log(`  eligible: ${eligibleCount} hands (by major count: 1=${eligibleByMajor[1]}, 2=${eligibleByMajor[2]}, 3=${eligibleByMajor[3]}, 4=${eligibleByMajor[4]})`);
  if (!mono) totalEligibleSlots += eligibleCount;
}

console.log('\n==================================================');
console.log('SUMMARY');
console.log('==================================================');
console.log(`Total eligible (opener × hand) pairs: ${totalEligibleSlots}`);
console.log(`Average per opener: ${(totalEligibleSlots / OPENERS.length).toFixed(1)}`);
console.log(`20 問の生成は ${totalEligibleSlots >= 20 ? '✓ 十分可能' : '✗ 不足'}`);
