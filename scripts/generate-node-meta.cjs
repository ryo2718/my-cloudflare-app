#!/usr/bin/env node
// Pre-extract per-node action label info from each JSON file.
// Output: src/data/nodeMeta.ts
//
// For each node_path, we record:
//   - lastAction: the most recent NON-FOLD action_history entry (the "interesting" action that led to this node)
//   - priorRaiseCount: how many Raise entries came before lastAction (used to label 3bet/4bet/5bet/6bet)
//
// Root nodes (depth 1) have empty action_history → lastAction = null.
// Used by src/data/scenarios.ts → labelForNodePath() for breadcrumb display.

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '../public/data/preflop/cash_100bb_6max_nl500_2.5x');
const OUT_FILE = path.resolve(__dirname, '../src/data/nodeMeta.ts');

function parseSize(action) {
  // Examples: "Raise 2.5" → 2.5, "Allin 100" → 100, "Allin" → null, "Call" → null, "Fold" → null
  const m = action.match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

function extractMeta(d) {
  const ah = (d.game_info && d.game_info.action_history) || [];
  let lastIdx = -1;
  for (let i = ah.length - 1; i >= 0; i--) {
    if (ah[i].action !== 'Fold') { lastIdx = i; break; }
  }
  if (lastIdx === -1) {
    return { lastAction: null, priorRaiseCount: 0 };
  }
  const lastEntry = ah[lastIdx];
  let priorRaiseCount = 0;
  for (let i = 0; i < lastIdx; i++) {
    if (ah[i].action.startsWith('Raise')) priorRaiseCount++;
  }
  return {
    lastAction: {
      position: lastEntry.position,
      actionRaw: lastEntry.action,
      sizeBB: parseSize(lastEntry.action),
    },
    priorRaiseCount,
  };
}

const files = fs.readdirSync(DATA_DIR)
  .filter(f => f.endsWith('.json'))
  .sort();

const meta = {};
for (const f of files) {
  const np = f.replace('.json', '');
  const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'));
  meta[np] = extractMeta(data);
}

const lines = [
  '// AUTO-GENERATED. Do not edit by hand.',
  '// Source: public/data/preflop/cash_100bb_6max_nl500_2.5x/*.json (action_history)',
  '// Regenerate with:  node scripts/generate-node-meta.cjs',
  '',
  '/** 単一の action_history エントリ。Raise/Allin の場合のみ sizeBB が入る。 */',
  'export interface NodeAction {',
  '  position: string;          // "UTG" | "HJ" | ...',
  '  actionRaw: string;         // 原文 ("Raise 12", "Allin 100", "Allin", "Call" 等)',
  '  sizeBB: number | null;     // パース済みサイズ。"Allin"単独や"Call"はnull',
  '}',
  '',
  '/** 各ノードの「ここまで来るために最後に取られたアクション」と、',
  ' *  そのアクションより前にあった Raise の総数 (3bet/4bet/5bet/6bet 判定用)。 */',
  'export interface NodeMeta {',
  '  lastAction: NodeAction | null;  // depth=1 ルートでは null',
  '  priorRaiseCount: number;',
  '}',
  '',
  'export const NODE_META: Readonly<Record<string, NodeMeta>> = {',
];
for (const np of Object.keys(meta).sort()) {
  lines.push(`  ${JSON.stringify(np)}: ${JSON.stringify(meta[np])},`);
}
lines.push('};');
lines.push('');

fs.writeFileSync(OUT_FILE, lines.join('\n'));
console.log(`wrote ${Object.keys(meta).length} node meta entries to ${OUT_FILE}`);
