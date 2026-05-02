#!/usr/bin/env node
// Read-only validator for preflop range JSONs.
// Usage:  node scripts/validate-ranges.js
//
// Checks 10 rules described in the project request and prints
// errors / warnings + per-rule summary. Exits with non-zero if
// any error is found.

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'public', 'data', 'preflop', 'cash_100bb_6max_nl500_2.5x');

// ---------------------------------------------------------------------------
// Hand combo helpers
// ---------------------------------------------------------------------------
function combosFor(hand) {
  if (hand.length === 2) return 6;            // pair (e.g., AA)
  if (hand.endsWith('s')) return 4;           // suited (e.g., AKs)
  if (hand.endsWith('o')) return 12;          // offsuit (e.g., AKo)
  return 0;                                   // shouldn't happen
}

const RANKS = ['A','K','Q','J','T','9','8','7','6','5','4','3','2'];
const ALL_HANDS = (() => {
  const out = [];
  for (let i = 0; i < RANKS.length; i++) out.push(RANKS[i] + RANKS[i]);
  for (let i = 0; i < RANKS.length; i++) {
    for (let j = i + 1; j < RANKS.length; j++) {
      out.push(RANKS[i] + RANKS[j] + 's');
      out.push(RANKS[i] + RANKS[j] + 'o');
    }
  }
  return out;
})();

// 4 アクション + 場合によって check
const ACTION_KEYS = ['fold', 'call', 'raise', 'allin', 'check'];

// ---------------------------------------------------------------------------
// Aggregate computation (combo-weighted per-action %)
// ---------------------------------------------------------------------------
function computeAggregate(hands) {
  const totals = { fold: 0, call: 0, raise: 0, allin: 0, check: 0 };
  let totalCombos = 0;
  for (const [hand, h] of Object.entries(hands)) {
    const cb = combosFor(hand);
    totalCombos += cb;
    for (const a of ACTION_KEYS) {
      totals[a] += cb * (h[a] || 0);
    }
  }
  if (totalCombos === 0) return { totalCombos: 0, fold: 0, call: 0, raise: 0, allin: 0, check: 0 };
  for (const a of ACTION_KEYS) totals[a] /= totalCombos;
  return { totalCombos, ...totals };
}

// path で raise 段の数を数える (segment が 'r' で終わるもの)
function countRaiseSegments(nodePath) {
  return nodePath.split('_').filter((s) => s.endsWith('r')).length;
}

// path 中の (last-1 まで) 任意の segment が all-in (`ai` 末尾) を含む？
function hasAllinBeforeLast(nodePath) {
  const segs = nodePath.split('_');
  for (let i = 0; i < segs.length - 1; i++) {
    if (segs[i].endsWith('ai')) return true;
  }
  return false;
}

// 親 path (= 同じ hero が直前に居たノード) を導出
function structuralParent(nodePath) {
  const segs = nodePath.split('_');
  if (segs.length === 1) return null; // RFI root
  const secondLast = segs[segs.length - 2];
  let actor;
  if (secondLast.endsWith('ai')) actor = secondLast.slice(0, -2);
  else if (secondLast.endsWith('r')) actor = secondLast.slice(0, -1);
  else if (secondLast.endsWith('c')) actor = secondLast.slice(0, -1);
  else return null;
  return [...segs.slice(0, -2), actor].join('_');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const errors = [];
const warnings = [];
const ruleStats = {};

function record(level, file, rule, message) {
  const target = level === 'error' ? errors : warnings;
  target.push({ file, rule, message });
  ruleStats[rule] = (ruleStats[rule] || 0) + 1;
}

function validateFile(filename, allFilenames) {
  const filepath = path.join(DATA_DIR, filename);
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch (e) {
    record('error', filename, 'parse', 'JSON parse error: ' + e.message);
    return;
  }
  const nodeId = filename.replace('.json', '');
  const hands = data.hands || {};
  const hero = data.game_info?.hero_position;
  const avail = (data.game_info?.available_actions_at_this_node || []).map((a) => a.toLowerCase());
  const nodePath = data.game_info?.node_path || nodeId;
  const isRfiRoot = nodePath.split('_').length === 1;
  const raiseCount = countRaiseSegments(nodePath);
  const aggr = computeAggregate(hands);

  // ----- Rule 2: per-hand frequency sum -----
  // 99.5..100.5 = OK / 98..102 (= ±1) = warning (scraper の整数丸め誤差) / 外側 = error
  for (const [hand, h] of Object.entries(hands)) {
    const sum = ACTION_KEYS.reduce((s, a) => s + (h[a] || 0), 0);
    if (sum < 98 || sum > 102) {
      record('error', filename, 'R2-hand-sum',
        `${hand} の頻度合計が ${sum.toFixed(2)} (期待 99.5–100.5、許容外)`);
    } else if (sum < 99.5 || sum > 100.5) {
      record('warning', filename, 'R2-hand-rounding',
        `${hand} の頻度合計が ${sum.toFixed(2)} (scraper 整数丸めによる ±1 誤差)`);
    }
  }

  // ----- Rule 1: aggregate sum 99.5..100.5 (combo-weighted) -----
  const aggSum = aggr.fold + aggr.call + aggr.raise + aggr.allin + aggr.check;
  if (Object.keys(hands).length > 0 && (aggSum < 99.5 || aggSum > 100.5)) {
    record('error', filename, 'R1-aggregate-sum',
      `aggregate 合計 ${aggSum.toFixed(2)}% (F=${aggr.fold.toFixed(1)} C=${aggr.call.toFixed(1)} R=${aggr.raise.toFixed(1)} AI=${aggr.allin.toFixed(1)})`);
  }

  // ----- Rule 3: RFI root で Call が available_actions に無いのに使われている -----
  // 例外: SB は SB blind を complete (limp) できるため、available_actions に Call が
  //       含まれる preset がある (例: sb.json 'Allin','Raise','Call','Fold')。
  //       この場合 Call > 0 は仕様通り。avail に Call が無いケースのみ error。
  if (isRfiRoot && !avail.includes('call')) {
    for (const [hand, h] of Object.entries(hands)) {
      if ((h.call || 0) > 0) {
        record('error', filename, 'R3-rfi-no-call',
          `RFI root で ${hand} が Call ${h.call.toFixed(1)}% (Call は available_actions に無い)`);
      }
    }
  }

  // ----- Rule 4: post-allin response must have no Raise -----
  if (hasAllinBeforeLast(nodePath)) {
    for (const [hand, h] of Object.entries(hands)) {
      if ((h.raise || 0) > 0) {
        record('error', filename, 'R4-post-allin-no-raise',
          `All-in 後の応答ノードで ${hand} が Raise ${h.raise.toFixed(1)}% (もう raise 余地なし)`);
      }
    }
  }

  // ----- Rule 5: 5bet response (raiseCount >= 4) → Call > 30% は警告 -----
  if (raiseCount >= 4 && aggr.call > 30) {
    record('warning', filename, 'R5-5bet-call-high',
      `raise${raiseCount}回後 (5bet以降) で aggregate Call=${aggr.call.toFixed(1)}% (commit済み、Call 異常に高い)`);
  }

  // ----- Rule 6: 4bet+ で All-in が available なのに 0% -----
  if (raiseCount >= 3 && avail.includes('allin') && aggr.allin === 0) {
    record('warning', filename, 'R6-4bet-no-allin',
      `raise${raiseCount}回後 (4bet以降) で All-in が available だが aggregate All-in=0%`);
  }

  // ----- Rule 7: AA/KK/QQ Fold > 30% -----
  for (const premium of ['AA', 'KK', 'QQ']) {
    const h = hands[premium];
    if (!h) continue; // sparse: 到達してない
    const fold = h.fold || 0;
    if (fold > 30) {
      record('warning', filename, 'R7-premium-fold',
        `${premium} の Fold=${fold.toFixed(1)}% (プレミア過剰 fold)`);
    }
  }

  // ----- Rule 8: combo 数 — 本スキーマには配列が無い (sparse %のみ) ためスキップ -----
  // ログとしてスクリプト末尾で1度だけ "Skipped" を表示する

  // ----- Rule 9: aggregate Fold > 99% -----
  if (Object.keys(hands).length > 0 && aggr.fold > 99) {
    record('warning', filename, 'R9-near-all-fold',
      `aggregate Fold=${aggr.fold.toFixed(1)}% (ほぼ全 fold ノード — データ抜け疑い)`);
  }

  // ----- Rule 10: 親ノード存在確認 -----
  const parent = structuralParent(nodePath);
  if (parent && !allFilenames.has(parent + '.json')) {
    record('error', filename, 'R10-missing-parent',
      `親ノード "${parent}.json" が見つからない`);
  }

  // hero / nodeId 整合性 (オマケ)
  if (data.game_info && data.game_info.node_path !== nodeId) {
    record('error', filename, 'R0-node_path-mismatch',
      `game_info.node_path="${data.game_info.node_path}" がファイル名 "${nodeId}" と不一致`);
  }
  if (hero) {
    const tail = nodeId.split('_').pop().toUpperCase();
    if (tail !== hero) {
      record('error', filename, 'R0-hero-mismatch',
        `node_path 末尾 "${tail}" と hero "${hero}" が不一致`);
    }
  }
}

function main() {
  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'));
  const fileSet = new Set(files);
  for (const file of files) validateFile(file, fileSet);

  const lines = [];
  lines.push('=== 検証結果 ===');
  lines.push(`総ファイル数: ${files.length}`);
  lines.push(`エラー: ${errors.length}件`);
  lines.push(`警告: ${warnings.length}件`);
  lines.push('');

  if (errors.length > 0) {
    lines.push('--- エラー ---');
    for (const e of errors) lines.push(`[${e.file}] ${e.rule}: ${e.message}`);
    lines.push('');
  }
  if (warnings.length > 0) {
    lines.push('--- 警告 ---');
    for (const w of warnings) lines.push(`[${w.file}] ${w.rule}: ${w.message}`);
    lines.push('');
  }

  lines.push('--- サマリ (ルール別件数) ---');
  const ruleNames = {
    'R0-node_path-mismatch': 'R0: node_path mismatch',
    'R0-hero-mismatch': 'R0: hero mismatch',
    'R1-aggregate-sum': 'R1: aggregate 合計',
    'R2-hand-sum': 'R2: per-hand 合計 (98外)',
    'R2-hand-rounding': 'R2: per-hand 丸め誤差 (98–99.5 / 100.5–102)',
    'R3-rfi-no-call': 'R3: RFI root に Call (avail外)',
    'R4-post-allin-no-raise': 'R4: All-in 後の Raise',
    'R5-5bet-call-high': 'R5: 5bet 以降 Call > 30%',
    'R6-4bet-no-allin': 'R6: 4bet+ で All-in 0%',
    'R7-premium-fold': 'R7: AA/KK/QQ の Fold > 30%',
    'R9-near-all-fold': 'R9: aggregate Fold > 99%',
    'R10-missing-parent': 'R10: 親ノード不在',
    parse: 'parse エラー',
  };
  for (const [key, label] of Object.entries(ruleNames)) {
    if (ruleStats[key]) lines.push(`  ${label}: ${ruleStats[key]}件`);
  }
  lines.push('');
  lines.push('R8 (combo 数チェック): 本スキーマは frequency-only (combo配列なし) のためスキップ');

  console.log(lines.join('\n'));
  process.exit(errors.length > 0 ? 1 : 0);
}

main();
