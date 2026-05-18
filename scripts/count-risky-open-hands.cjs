#!/usr/bin/env node
// 「際どい open」境界ハンドリスト集計。
// 条件: raise % と fold % の両方が >0 かつ <99.999 (混合戦略) かつ tier 表に存在。

const fs = require('fs');
const path = require('path');

const DATA_ROOT = path.resolve(__dirname, '../public/data/preflop/cash_100bb_6max_nl500_2.5x');
const EV_RANKING_TS = path.resolve(__dirname, '../src/data/evRanking.ts');

function parseEvRanking() {
  const txt = fs.readFileSync(EV_RANKING_TS, 'utf8');
  const set = new Set();
  const re = /"([A-Za-z0-9]+)":\s*\{[^}]*"tier"/g;
  let m;
  while ((m = re.exec(txt)) !== null) set.add(m[1]);
  return set;
}

const TIER = parseEvRanking();
const OPENERS = ['UTG', 'HJ', 'CO', 'BTN', 'SB'];

function isRisky(s) {
  const r = s.raise || 0;
  const f = s.fold || 0;
  return r > 0.001 && f > 0.001 && r < 99.999 && f < 99.999;
}

console.log('=========================================');
console.log('際どい open 境界ハンドリスト (混合戦略)');
console.log('=========================================');

for (const op of OPENERS) {
  const fp = path.join(DATA_ROOT, `${op.toLowerCase()}.json`);
  if (!fs.existsSync(fp)) continue;
  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
  const hands = Object.entries(data.hands)
    .filter(([h, s]) => TIER.has(h) && isRisky(s))
    .map(([h, s]) => ({
      h,
      raise: s.raise,
      call: s.call,
      fold: s.fold,
      allin: s.allin,
    }));
  console.log(`\n[${op}] eligible 際どい open: ${hands.length} ハンド`);
  for (const h of hands) {
    console.log(
      `  ${h.h.padEnd(5)} ai:${String(h.allin ?? 0).padStart(5)} r:${String(h.raise).padStart(5)} c:${String(h.call).padStart(5)} f:${String(h.fold).padStart(5)}`,
    );
  }
}
