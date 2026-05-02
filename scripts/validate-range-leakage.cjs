#!/usr/bin/env node
// Read-only leakage validator.
// 仮説: 子ノードの hands に「経路上で hero がフォールド/到達不可だったハンド」が混入してないか?
//
// アルゴリズム (transitive):
//   1. 子の path から hero を取得
//   2. path を遡って hero が「行動した」全祖先ノードを列挙し、各ノードでの advance アクション
//      ('r' → raise, 'c' → call, 'ai' → allin) を記録
//   3. 各ハンドについて、survival probability = 各祖先ノードで「advance アクション頻度 / 100」の積
//   4. survival ≈ 0 のハンドが子に存在 = リーク
//
// Usage:  npm run validate-leakage
// Output: per-file リーク詳細 + サマリ + 修正後 aggregate のシミュレーション

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'public', 'data', 'preflop', 'cash_100bb_6max_nl500_2.5x');
const SURVIVAL_THRESHOLD = 0.001; // この未満を「実質 0」扱いとする

// ---------- combo helper ----------
function combosFor(hand) {
  if (hand.length === 2) return 6;
  if (hand.endsWith('s')) return 4;
  if (hand.endsWith('o')) return 12;
  return 0;
}

// ---------- ロード ----------
const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'));
const all = {};
for (const f of files) {
  all[f.replace('.json', '')] = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'));
}

// ---------- hero ancestors ----------
/**
 * nodePath を遡り、hero (= 末尾 segment) が行動した全祖先ノードを返す。
 *   各 entry: { path, advanceActionKey: 'raise'|'call'|'allin' }
 *   path は「祖先ノードの node_path」(= hero が判断する直前の状態)
 *   advanceActionKey は「そこで hero が次に進むために取ったアクション」
 *
 * 例: "utgr_hjr_utgr_hjr_utg" (hero=utg) →
 *   [
 *     { path: "utg",            advanceActionKey: "raise" },  // segs[0] "utgr"
 *     { path: "utgr_hjr_utg",   advanceActionKey: "raise" },  // segs[2] "utgr"
 *   ]
 */
function heroAncestors(nodePath) {
  const segs = nodePath.split('_');
  const hero = segs[segs.length - 1];
  const ancestors = [];
  for (let i = 0; i < segs.length - 1; i++) {
    const seg = segs[i];
    let actor, key;
    if (seg.endsWith('ai')) { actor = seg.slice(0, -2); key = 'allin'; }
    else if (seg.endsWith('r')) { actor = seg.slice(0, -1); key = 'raise'; }
    else if (seg.endsWith('c')) { actor = seg.slice(0, -1); key = 'call'; }
    else continue;
    if (actor === hero) {
      const ancPath = [...segs.slice(0, i), hero].join('_');
      ancestors.push({ path: ancPath, advanceActionKey: key });
    }
  }
  return ancestors;
}

// ---------- survival ----------
function survival(hand, ancestors) {
  let prob = 1.0;
  const trace = [];
  for (const anc of ancestors) {
    const ancData = all[anc.path];
    if (!ancData) {
      trace.push(`${anc.path}: MISSING`);
      return { prob: 0, trace };
    }
    const handData = ancData.hands[hand];
    if (!handData) {
      trace.push(`${anc.path}: ${hand} 不在 (sparse)`);
      return { prob: 0, trace };
    }
    const pct = handData[anc.advanceActionKey] || 0;
    trace.push(`${anc.path}: ${anc.advanceActionKey}=${pct.toFixed(1)}%`);
    prob *= pct / 100;
    if (prob === 0) return { prob: 0, trace };
  }
  return { prob, trace };
}

// ---------- aggregate ----------
function computeAggregate(hands) {
  const totals = { fold: 0, call: 0, raise: 0, allin: 0, check: 0 };
  let totalCombos = 0;
  for (const [hand, h] of Object.entries(hands)) {
    const cb = combosFor(hand);
    totalCombos += cb;
    totals.fold += cb * (h.fold || 0);
    totals.call += cb * (h.call || 0);
    totals.raise += cb * (h.raise || 0);
    totals.allin += cb * (h.allin || 0);
    totals.check += cb * (h.check || 0);
  }
  if (totalCombos === 0) return { totalCombos: 0, fold: 0, call: 0, raise: 0, allin: 0, check: 0 };
  return {
    totalCombos,
    fold:  totals.fold  / totalCombos,
    call:  totals.call  / totalCombos,
    raise: totals.raise / totalCombos,
    allin: totals.allin / totalCombos,
    check: totals.check / totalCombos,
  };
}

// ---------- main ----------
const leaks = {}; // path → [{ hand, combos, survival, freq, trace }]
let totalLeakHands = 0;
let totalLeakCombos = 0;
let nodesScanned = 0;
let nodesWithLeak = 0;

for (const [nodePath, data] of Object.entries(all)) {
  const ancestors = heroAncestors(nodePath);
  if (ancestors.length === 0) continue; // RFI root or vs-RFI (hero hasn't acted)
  nodesScanned++;

  const fileLeaks = [];
  for (const [hand, h] of Object.entries(data.hands || {})) {
    const { prob, trace } = survival(hand, ancestors);
    if (prob < SURVIVAL_THRESHOLD) {
      fileLeaks.push({ hand, combos: combosFor(hand), survival: prob, freq: h, trace });
    }
  }
  if (fileLeaks.length > 0) {
    leaks[nodePath] = fileLeaks;
    nodesWithLeak++;
    totalLeakHands += fileLeaks.length;
    totalLeakCombos += fileLeaks.reduce((s, l) => s + l.combos, 0);
  }
}

// ---------- print ----------
console.log('=== レンジリーク検証 ===');
console.log(`scanned (RFI/vs-RFI 除外): ${nodesScanned} / ${files.length}`);
console.log(`リーク含むノード数:        ${nodesWithLeak}`);
console.log(`リーク (hand × node) 合計: ${totalLeakHands}`);
console.log(`リーク 総 combos:           ${totalLeakCombos}`);
console.log('');

// 上位 (リーク combos が多い順) を 10件詳細
const ranked = Object.entries(leaks)
  .map(([np, ls]) => ({
    np,
    ls,
    leakCombos: ls.reduce((s, l) => s + l.combos, 0),
    childCombos: Object.keys(all[np].hands || {}).reduce((s, h) => s + combosFor(h), 0),
  }))
  .sort((a, b) => b.leakCombos - a.leakCombos);

if (ranked.length === 0) {
  console.log('リーク無し ✓ (hands は全て transitive に survival > 0)');
  process.exit(0);
}

console.log(`--- 上位 ${Math.min(10, ranked.length)} ノード (リーク combos 大) ---`);
for (const r of ranked.slice(0, 10)) {
  const ancestors = heroAncestors(r.np);
  console.log('');
  console.log(`[${r.np}.json]`);
  console.log(`  経路 (hero-action 祖先): ${ancestors.map(a => a.path + '(' + a.advanceActionKey + ')').join(' → ')}`);
  console.log(`  リーク: ${r.ls.length} hands / ${r.leakCombos} combos`);
  console.log(`  子の総 combos: ${r.childCombos} (リーク比率: ${((r.leakCombos / r.childCombos) * 100).toFixed(1)}%)`);

  // 現状の aggregate
  const cur = computeAggregate(all[r.np].hands || {});
  console.log(`  現状 aggregate: F=${cur.fold.toFixed(1)} C=${cur.call.toFixed(1)} R=${cur.raise.toFixed(1)} AI=${cur.allin.toFixed(1)} (sum ${(cur.fold+cur.call+cur.raise+cur.allin+cur.check).toFixed(1)})`);

  // リーク除外後の aggregate
  const leakSet = new Set(r.ls.map((l) => l.hand));
  const filteredHands = Object.fromEntries(
    Object.entries(all[r.np].hands || {}).filter(([h]) => !leakSet.has(h))
  );
  const filt = computeAggregate(filteredHands);
  console.log(`  リーク除外後:   F=${filt.fold.toFixed(1)} C=${filt.call.toFixed(1)} R=${filt.raise.toFixed(1)} AI=${filt.allin.toFixed(1)} (sum ${(filt.fold+filt.call+filt.raise+filt.allin+filt.check).toFixed(1)}, hands ${Object.keys(filteredHands).length})`);

  // 上位5ハンドのサンプル
  const sample = r.ls.slice(0, 5);
  for (const s of sample) {
    const v = s.freq;
    const fmt = `R=${(v.raise||0).toFixed(0)} C=${(v.call||0).toFixed(0)} AI=${(v.allin||0).toFixed(0)} F=${(v.fold||0).toFixed(0)}`;
    console.log(`    - ${s.hand} (${s.combos} combos): 子 ${fmt}  | survival≈0 経路: ${s.trace.join(' → ')}`);
  }
  if (r.ls.length > sample.length) {
    console.log(`    ... 他 ${r.ls.length - sample.length} hands`);
  }
}

console.log('');
console.log('--- 全リークノード一覧 ---');
for (const r of ranked) {
  console.log(`  ${r.np}: ${r.ls.length} hands / ${r.leakCombos} combos (${((r.leakCombos / r.childCombos) * 100).toFixed(1)}% of child)`);
}

process.exit(1);
