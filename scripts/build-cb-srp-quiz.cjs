#!/usr/bin/env node
// CB (Continuation Bet) SRP クイズデータを生成。
//
// 入力: data/cash_100bb_6max_nl500_2.5x/<variant>/flop_*.json
// 出力: cb/cb_srp/<variant>.json (12 件) + cb/cb_srp/manifest.json
//
// CB ノードの定義:
//   - アグレッサー = preflop の最後のレイザー (SRP では opener)
//   - アグレッサーが IP postflop  → 「OOP がチェック後にアグレッサーが決定」
//     CB ノード = flop_<oop>_x.json
//   - アグレッサーが OOP postflop → 「アグレッサーが最初に決定」
//     CB ノード = flop_root.json
//
// CB の判定: action_code が 'X' 以外で freq > 0 のもの全部の合計 = CB rate。
// 'X' (check) の freq = check_rate。

const fs = require('fs');
const path = require('path');

const DATA_ROOT = path.resolve(__dirname, '..', 'data', 'cash_100bb_6max_nl500_2.5x');
const OUT_DIR = path.resolve(__dirname, '..', 'cb', 'cb_srp');

// Postflop の座席順 (earlier seat = OOP)
const POSTFLOP_ORDER = ['SB', 'BB', 'UTG', 'HJ', 'CO', 'BTN'];

// SRP 全 12 variants
const SRP_VARIANTS = [
  { name: 'btnr_bbc',  aggressor: 'BTN', defender: 'BB'  },
  { name: 'btnr_sbc',  aggressor: 'BTN', defender: 'SB'  },
  { name: 'cor_bbc',   aggressor: 'CO',  defender: 'BB'  },
  { name: 'cor_btnc',  aggressor: 'CO',  defender: 'BTN' },
  { name: 'cor_sbc',   aggressor: 'CO',  defender: 'SB'  },
  { name: 'hjr_bbc',   aggressor: 'HJ',  defender: 'BB'  },
  { name: 'hjr_btnc',  aggressor: 'HJ',  defender: 'BTN' },
  { name: 'hjr_sbc',   aggressor: 'HJ',  defender: 'SB'  },
  { name: 'sbr_bbc',   aggressor: 'SB',  defender: 'BB'  },
  { name: 'utgr_bbc',  aggressor: 'UTG', defender: 'BB'  },
  { name: 'utgr_btnc', aggressor: 'UTG', defender: 'BTN' },
  { name: 'utgr_sbc',  aggressor: 'UTG', defender: 'SB'  },
];

function determineRoles(aggressor, defender) {
  const aIdx = POSTFLOP_ORDER.indexOf(aggressor);
  const dIdx = POSTFLOP_ORDER.indexOf(defender);
  if (aIdx === -1 || dIdx === -1) {
    throw new Error(`Unknown position: ${aggressor} or ${defender}`);
  }
  const [oop, ip] = aIdx < dIdx ? [aggressor, defender] : [defender, aggressor];
  const aggressorRole = oop === aggressor ? 'OOP' : 'IP';
  return { oop, ip, aggressorRole };
}

function cbNodeFilename(aggressorRole, oop) {
  return aggressorRole === 'OOP' ? 'flop_root.json' : `flop_${oop.toLowerCase()}_x.json`;
}

function cbChain(aggressorRole, oop) {
  return aggressorRole === 'OOP' ? [] : [`${oop.toLowerCase()}_x`];
}

/** CB rate = X 以外の (R<size> / RAI) の頻度合計。check_rate = X の頻度。 */
function summarize(actions) {
  let cb = 0;
  let check = 0;
  for (const a of actions) {
    if (a.action_code === 'X') check += a.frequency;
    else if (a.action_code !== 'F' && a.action_code !== 'C') cb += a.frequency;
  }
  return { cb_rate: cb, check_rate: check };
}

function compactActions(actions) {
  // 表示しきい値: 0.5% 未満 (Math.round で 0% になる) は drop
  return actions
    .filter((a) => Math.round(a.frequency * 100) > 0)
    .map((a) => ({ code: a.action_code, freq: Number(a.frequency.toFixed(5)) }));
}

function buildScenario(spec) {
  const { oop, ip, aggressorRole } = determineRoles(spec.aggressor, spec.defender);
  const filename = cbNodeFilename(aggressorRole, oop);
  const filePath = path.join(DATA_ROOT, spec.name, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing CB node file: ${filePath}`);
  }
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  const aggregate = summarize(data.action_totals);
  const aggregateActions = compactActions(data.action_totals);

  const boards = data.solutions.map((s) => {
    const sum = summarize(s.action_solutions);
    return {
      name: s.name,
      cb_rate: Number(sum.cb_rate.toFixed(5)),
      check_rate: Number(sum.check_rate.toFixed(5)),
      actions: compactActions(s.action_solutions),
    };
  });

  // player_totals (EV / EQ / EQR) も保持 (アグレッサー側のみ抜粋)
  const aggressorTotals = data.player_totals.find((p) => p.position === spec.aggressor);
  const defenderTotals = data.player_totals.find((p) => p.position === spec.defender);

  return {
    variant: spec.name,
    depth: 'SRP',
    aggressor: { position: spec.aggressor, role: aggressorRole, totals: aggressorTotals },
    defender: { position: spec.defender, role: aggressorRole === 'OOP' ? 'IP' : 'OOP', totals: defenderTotals },
    oop,
    ip,
    cb_node: { filename, chain: cbChain(aggressorRole, oop) },
    aggregate: {
      cb_rate: Number(aggregate.cb_rate.toFixed(5)),
      check_rate: Number(aggregate.check_rate.toFixed(5)),
      action_breakdown: aggregateActions,
    },
    boards,
  };
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const manifest = [];
  for (const spec of SRP_VARIANTS) {
    process.stdout.write(`  Building ${spec.name}... `);
    const scenario = buildScenario(spec);
    const outPath = path.join(OUT_DIR, `${spec.name}.json`);
    fs.writeFileSync(outPath, JSON.stringify(scenario, null, 2));
    const sizeKB = (fs.statSync(outPath).size / 1024).toFixed(1);
    process.stdout.write(`${scenario.boards.length} boards, CB rate ${(scenario.aggregate.cb_rate * 100).toFixed(1)}%, ${sizeKB}KB\n`);
    manifest.push({
      variant: spec.name,
      aggressor: spec.aggressor,
      aggressor_role: scenario.aggressor.role,
      defender: spec.defender,
      oop: scenario.oop,
      ip: scenario.ip,
      cb_node: scenario.cb_node,
      aggregate_cb_rate: scenario.aggregate.cb_rate,
      aggregate_check_rate: scenario.aggregate.check_rate,
      board_count: scenario.boards.length,
    });
  }

  const manifestPath = path.join(OUT_DIR, 'manifest.json');
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        kind: 'cb_srp_quiz',
        description: 'Continuation Bet (CB) quiz dataset for all SRP scenarios in cash_100bb_6max_nl500_2.5x preset.',
        cb_definition: 'CB = preflop aggressor の flop における最初の aggressive action (= R<size> or RAI)。check は CB しない選択。',
        scenarios: manifest,
      },
      null,
      2,
    ),
  );
  console.log(`\nWrote ${SRP_VARIANTS.length} scenarios + manifest → ${path.relative(process.cwd(), OUT_DIR)}/`);
  const totalBytes = manifest.reduce(
    (s, m) => s + fs.statSync(path.join(OUT_DIR, `${m.variant}.json`)).size,
    0,
  ) + fs.statSync(manifestPath).size;
  console.log(`Total size: ${(totalBytes / 1024).toFixed(1)}KB`);
}

main();
