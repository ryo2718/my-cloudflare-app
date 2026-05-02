#!/usr/bin/env node
// In-place フィルタ修正: 各ノードから「経路上で hero が到達しないハンド」を削除する。
// validate-range-leakage.cjs と同じ transitive survival ロジックで判定。
//
// バックアップ前提: backups/before_leakage_fix_<date>/ に手動コピー済みであること。
//
// Usage:  node scripts/fix-range-leakage.cjs

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'public', 'data', 'preflop', 'cash_100bb_6max_nl500_2.5x');
const SURVIVAL_THRESHOLD = 0.001;

function combosFor(hand) {
  if (hand.length === 2) return 6;
  if (hand.endsWith('s')) return 4;
  if (hand.endsWith('o')) return 12;
  return 0;
}

// データを全部メモリに読む (生存確率計算で祖先を参照するため)
const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'));
const all = {};
for (const f of files) {
  all[f.replace('.json', '')] = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'));
}

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
      ancestors.push({ path: [...segs.slice(0, i), hero].join('_'), advanceActionKey: key });
    }
  }
  return ancestors;
}

function survival(hand, ancestors) {
  let prob = 1.0;
  for (const anc of ancestors) {
    const ancData = all[anc.path];
    if (!ancData) return 0;
    const handData = ancData.hands[hand];
    if (!handData) return 0;
    const pct = handData[anc.advanceActionKey] || 0;
    prob *= pct / 100;
    if (prob === 0) return 0;
  }
  return prob;
}

function aggregate(hands) {
  const t = { fold: 0, call: 0, raise: 0, allin: 0, check: 0 };
  let total = 0;
  for (const [h, v] of Object.entries(hands)) {
    const cb = combosFor(h);
    total += cb;
    t.fold += cb * (v.fold || 0);
    t.call += cb * (v.call || 0);
    t.raise += cb * (v.raise || 0);
    t.allin += cb * (v.allin || 0);
    t.check += cb * (v.check || 0);
  }
  return total === 0
    ? { totalCombos: 0, fold: 0, call: 0, raise: 0, allin: 0, check: 0 }
    : { totalCombos: total, fold: t.fold/total, call: t.call/total, raise: t.raise/total, allin: t.allin/total, check: t.check/total };
}

// ---- 修正本体 ----
const summary = [];

for (const nodePath of Object.keys(all)) {
  const ancestors = heroAncestors(nodePath);
  if (ancestors.length === 0) continue;

  const data = all[nodePath];
  const beforeAgg = aggregate(data.hands || {});

  const removed = [];
  for (const hand of Object.keys(data.hands || {})) {
    if (survival(hand, ancestors) < SURVIVAL_THRESHOLD) {
      removed.push(hand);
      delete data.hands[hand];
    }
  }

  if (removed.length > 0) {
    const afterAgg = aggregate(data.hands);
    fs.writeFileSync(
      path.join(DATA_DIR, nodePath + '.json'),
      JSON.stringify(data, null, 2) + '\n',
    );
    summary.push({
      nodePath,
      removedCount: removed.length,
      removedSample: removed.slice(0, 5),
      removedCombos: removed.reduce((s, h) => s + combosFor(h), 0),
      beforeAgg,
      afterAgg,
    });
  }
}

// ---- レポート ----
console.log('=== レンジリーク修正 ===');
console.log(`scanned: ${Object.keys(all).length} files`);
console.log(`修正対象: ${summary.length} files`);
const totalRemoved = summary.reduce((s, x) => s + x.removedCount, 0);
const totalCombosRemoved = summary.reduce((s, x) => s + x.removedCombos, 0);
console.log(`削除した hand x node ペア: ${totalRemoved}`);
console.log(`削除した combos:           ${totalCombosRemoved}`);
console.log('');

console.log('--- ファイル別 (リーク combos 大順) ---');
const ranked = summary.slice().sort((a, b) => b.removedCombos - a.removedCombos);
for (const r of ranked) {
  const ba = r.beforeAgg, aa = r.afterAgg;
  console.log(
    `${r.nodePath}: ${r.removedCount} hands / ${r.removedCombos} combos | ` +
    `aggregate F=${ba.fold.toFixed(0)}→${aa.fold.toFixed(0)} ` +
    `C=${ba.call.toFixed(0)}→${aa.call.toFixed(0)} ` +
    `R=${ba.raise.toFixed(0)}→${aa.raise.toFixed(0)} ` +
    `AI=${ba.allin.toFixed(0)}→${aa.allin.toFixed(0)}`,
  );
}
console.log('');
console.log('Done. 検証: npm run validate-leakage');
