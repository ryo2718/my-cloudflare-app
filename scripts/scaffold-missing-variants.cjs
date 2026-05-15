#!/usr/bin/env node
// 自作 variant のスケルトン JSON を生成。
//
// 対象:
//   1. btnr_bbr_btnc           ← BB-BTN 3bp (BTN open → BB 3-bet → BTN call)
//   2. cor_btnr_cor20_btnc     ← CO-BTN 4bp (CO open → BTN 3-bet → CO 4-bet 20bb → BTN call)
//
// 出力: data/cash_100bb_6max_nl500_2.5x/<variant>/flop_root.json (placeholder)
//
// 生成内容:
//   - 完全なスキーマ (top-level + nested fields すべて)
//   - 正しい _meta / players / OOP-IP 判定
//   - action_totals / solutions のスタブ (freq=0、X=null で 後で fill-in)
//   - 1755 ボード分の solutions[] (canonical 順)
//
// ユーザーは各 board の action_solutions.frequency を埋めて完成させる。

const fs = require('fs');
const path = require('path');

const DATA_ROOT = path.resolve(__dirname, '..', 'data', 'cash_100bb_6max_nl500_2.5x');
const BOARDS_FILE = path.resolve(__dirname, '..', 'cb', 'canonical_boards_1755.json');

const POSTFLOP_ORDER = ['SB', 'BB', 'UTG', 'HJ', 'CO', 'BTN'];

const VARIANTS = [
  {
    name: 'btnr_bbr_btnc',
    aggressor: 'BB',      // 最後のアグレッサー (= 3-bettor)
    caller: 'BTN',        // 3-bet に call したプレイヤー
    depth: '3bp',
    // ノード時点 (flop root) は OOP の番
    actor_at_root: 'BB',  // BB が OOP かつ最後のアグレッサー、root で先に動く
    // 提案 size 群 (ユーザーで自由に置換可)
    available_actions: [
      { code: 'X', label: 'check', betsize: '0', type: 'CHECK', byPot: null },
      { code: 'R7', label: 'bet 33% pot', betsize: '7.0', type: 'RAISE', byPot: '0.333' },
      { code: 'R14', label: 'bet 66% pot', betsize: '14.0', type: 'RAISE', byPot: '0.667' },
      { code: 'RAI', label: 'all-in', betsize: '88', type: 'RAISE', byPot: null }, // 例: 100bb スタックから 12 commited 残り 88
    ],
    // pot 設定: BTN 2.5x + BB 3bet 12bb + BTN call = 24bb at flop (1bb dead from SB)
    pot_at_flop: '24.0',
    stacks: { BTN: '88', BB: '88' },
  },
  {
    name: 'cor_btnr_cor20_btnc',
    aggressor: 'CO',      // 4-bettor
    caller: 'BTN',        // 4-bet に call
    depth: '4bp',
    actor_at_root: 'CO',  // CO が OOP かつ 4-bettor (= 最後のアグレッサー)
    available_actions: [
      { code: 'X', label: 'check', betsize: '0', type: 'CHECK', byPot: null },
      { code: 'R13', label: 'bet 33% pot', betsize: '13.0', type: 'RAISE', byPot: '0.333' },
      { code: 'R27', label: 'bet 66% pot', betsize: '27.0', type: 'RAISE', byPot: '0.667' },
      { code: 'RAI', label: 'all-in', betsize: '80', type: 'RAISE', byPot: null },
    ],
    // pot: CO open 2.5 + BTN 3bet ~8 + CO 4bet 20 + BTN call 20 = 40.5 (+0.5 dead from BB)
    pot_at_flop: '41.0',
    stacks: { CO: '80', BTN: '80' },
  },
];

function determineRoles(aggressor, caller) {
  const aIdx = POSTFLOP_ORDER.indexOf(aggressor);
  const cIdx = POSTFLOP_ORDER.indexOf(caller);
  return aIdx < cIdx
    ? { oop: aggressor, ip: caller }
    : { oop: caller, ip: aggressor };
}

function buildSixSeatPlayers(spec, oop, ip) {
  // 6 seats: SB, BB, UTG, HJ, CO, BTN
  return POSTFLOP_ORDER.map((pos) => {
    const isOop = pos === oop;
    const isIp = pos === ip;
    const isActive = isOop || isIp;
    return {
      relative_postflop_position: isOop ? 'OOP' : isIp ? 'IP' : null,
      hand: null,
      is_dealer: pos === 'BTN',
      is_folded: !isActive,
      is_hero: false,
      is_active: isActive,
      stack: '100',
      current_stack: isActive ? (spec.stacks[pos] ?? '100') : '100',
      chips_on_table: '0',
      bounty: null,
      profile: null,
      position: pos,
      bounty_in_bb: null,
    };
  });
}

function buildActionTotals(spec) {
  return spec.available_actions.map((a) => ({
    action_code: a.code,
    frequency: 0.0,        // ← 後で fill-in
    solved_action_count: 1755,
  }));
}

function buildPlayerTotals(spec, oop, ip) {
  return [
    { position: oop, ev: null, eq: null, eqr: null },
    { position: ip,  ev: null, eq: null, eqr: null },
  ];
}

function buildAvailableActions(spec, oop, ip) {
  const next = spec.actor_at_root === oop ? ip : oop;
  return spec.available_actions.map((a, idx) => ({
    action: {
      code: a.code,
      position: spec.actor_at_root,
      type: a.type,
      betsize: a.betsize,
      allin: a.code === 'RAI',
      is_hand_end: false,
      is_showdown: false,
      next_street: false,
      display_name: a.type === 'CHECK' ? 'CHECK' : (a.code === 'RAI' ? 'ALLIN' : 'RAISE'),
      simple_group: a.type === 'CHECK' ? 'CHECK' : 'RAISE',
      advanced_group: a.type === 'CHECK' ? 'CHECK' : (a.code === 'RAI' ? 'BET_OVERBET' : (idx === 1 ? 'BET_MEDIUM' : 'BET_LARGE')),
      betsize_by_pot: a.byPot,
      next_position: next,
    },
    frequency: null,
    is_solution_end: false,
    can_be_solved_by_ai: false,
    next_position: next,
    selected: false,
  }));
}

function buildSolutions(spec, oop, ip, boards) {
  // 1755 boards × 各 action_solution placeholder (X=1.0, それ以外 0.0)
  return boards.map((name) => ({
    name,
    ratio: null,
    action_solutions: spec.available_actions.map((a) => ({
      action_code: a.code,
      frequency: a.code === 'X' ? 1.0 : 0.0,  // 一時的に X=100% (= check のみ)、後で fill-in
    })),
    player_solutions: [
      { position: oop, ev: null, eq: null, eqr: null },
      { position: ip,  ev: null, eq: null, eqr: null },
    ],
  }));
}

function buildFile(spec, boards) {
  const { oop, ip } = determineRoles(spec.aggressor, spec.caller);
  const sixSeatPlayers = buildSixSeatPlayers(spec, oop, ip);
  const actionTotals = buildActionTotals(spec);
  const playerTotals = buildPlayerTotals(spec, oop, ip);

  // 表示用の代表 board (1 つ目を使用)
  const repBoard = boards[0];

  return {
    status: 'done',
    custom_tree_id: null,
    solutions: buildSolutions(spec, oop, ip, boards),
    players: [
      { position: oop, is_hero: true,  relative_position: 'OOP', profile: null },
      { position: ip,  is_hero: false, relative_position: 'IP',  profile: null },
    ],
    action_totals: actionTotals,
    filtered_action_totals: actionTotals,
    player_totals: playerTotals,
    filtered_player_totals: playerTotals,
    filtered_ratio: 1.0,
    game_point: {
      game: {
        players: sixSeatPlayers,
        current_street: { type: 'FLOP', start_pot: spec.pot_at_flop, end_pot: spec.pot_at_flop },
        pot: spec.pot_at_flop,
        pot_odds: '0.0',
        active_position: spec.actor_at_root,
        board: repBoard.slice(0, 6), // "2h2d2c" 等
        bet_display_name: 'RAISE',
      },
      available_actions: buildAvailableActions(spec, oop, ip),
      custom_solution_id: null,
      is_node_locked: false,
      is_edited: false,
      is_editable: false,
      forced_fold: false,
      available_node_edits: null,
      merged_actions: [],
      preset_action_code: 'X',
    },
    solved_board_count: null,
    total_board_count: null,
    _meta: {
      variant: spec.name,
      flop_chain: '',
      action_chain: [],
      depth: 0,
      next_actor: spec.actor_at_root.toLowerCase(),
      terminal_type: null,
      scraped_at: new Date().toISOString(),
    },
  };
}

function main() {
  if (!fs.existsSync(BOARDS_FILE)) {
    console.error(`canonical boards file not found: ${BOARDS_FILE}`);
    console.error(`先に build script を実行: node scripts/build-cb-srp-quiz.cjs (cb/ ディレクトリ作成済の前提)`);
    process.exit(1);
  }
  const boards = JSON.parse(fs.readFileSync(BOARDS_FILE, 'utf8'));
  console.log(`Loaded ${boards.length} canonical boards`);

  for (const spec of VARIANTS) {
    const dir = path.join(DATA_ROOT, spec.name);
    fs.mkdirSync(dir, { recursive: true });
    const out = path.join(dir, 'flop_root.json');
    const data = buildFile(spec, boards);
    fs.writeFileSync(out, JSON.stringify(data, null, 2));
    const sizeKB = (fs.statSync(out).size / 1024).toFixed(1);
    console.log(`  ✓ ${spec.name}/flop_root.json (${spec.depth}, ${sizeKB} KB, ${data.solutions.length} boards)`);
  }

  console.log(`\nNext steps for user:`);
  console.log(`  1. data/cash_*/btnr_bbr_btnc/flop_root.json の action_totals + solutions[].action_solutions を実 GTO 値で fill-in`);
  console.log(`  2. data/cash_*/cor_btnr_cor20_btnc/flop_root.json も同様`);
  console.log(`  3. (任意) player_totals / player_solutions の ev/eq/eqr も埋めれば BoardSummary が表示可`);
  console.log(`  4. node scripts/generate-flop-manifest.cjs で manifest を再生成`);
  console.log(`  5. UI Picker で BB-BTN 3bp / CO-BTN 4bp が enable される`);
}

main();
