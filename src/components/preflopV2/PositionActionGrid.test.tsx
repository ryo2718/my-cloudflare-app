import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PositionActionGrid } from './PositionActionGrid';
import { buildGridColumns } from '../../data/preflopV2/gridColumns';
import type { PreflopV2Index, PreflopV2Node } from '../../data/preflopV2/types';

// index.nodes[stem] = { token(canonical): targetStem } (skip-connect 済)
function idx(nodes: Record<string, Record<string, string>>): PreflopV2Index {
  return {
    config: 'c', label: 'L', stackBb: 100, rake: 'NL500', openSize: 'gto',
    positionOrder: ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
    entries: {}, nodes,
  };
}
function players(heroPos: string, folded: string[]) {
  return ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'].map((p) => ({
    position: p,
    is_hero: p === heroPos,
    is_active: p === heroPos,
    is_folded: folded.includes(p),
  }));
}

describe('PositionActionGrid', () => {
  it('renders all 6 columns; actor shows 4 choices, committed folds are grey 1-cell', () => {
    const node: PreflopV2Node = {
      _meta: { preflop_actions: 'F-F-F', actor: 'btn' },
      game_info: { players: players('BTN', ['UTG', 'HJ', 'CO']) },
      actions_legend: { F: 'fold (0bb)', 'R2.5': 'raise (2.5bb)' },
      hands: {},
    };
    const html = renderToStaticMarkup(
      <PositionActionGrid config="c" node={node} index={idx({ F_F_F: { F: 'F_F_F_F', 'R2.5': 'F_F_F_R2_5' } })} />,
    );
    for (const p of ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']) expect(html).toContain(p);
    expect(html).toContain('open'); // BTN raise named open
    expect(html).toContain('fold');
    expect(html.toUpperCase()).toContain('B4B2A9'); // committed/auto-fold grey
    expect(html.toUpperCase()).toContain('D8443C'); // BTN open = raise red (tappable)
    expect(html).toContain('type="button"');
  });

  it('all positions x all choices: non-actor positions render tappable cells too', () => {
    const node: PreflopV2Node = {
      _meta: { preflop_actions: '', actor: 'utg' },
      game_info: { players: players('UTG', []) },
      actions_legend: { F: 'fold', R2: 'raise (2bb)' },
      hands: {},
    };
    const index = idx({
      root: { F: 'F', R2: 'R2' },
      F: { F: 'F_F', R2: 'F_R2' }, // HJ RFI
      F_F: { F: 'F_F_F', R2: 'F_F_R2' }, // CO RFI
    });
    const html = renderToStaticMarkup(<PositionActionGrid config="c" node={node} index={index} />);
    const buttons = (html.match(/<button/g) ?? []).length;
    expect(buttons).toBeGreaterThanOrEqual(4); // UTG + HJ + CO each tappable
    expect(html.toUpperCase()).toContain('D8443C'); // open (raise) red
  });

  it('greys out call when it is not reachable (vs-open node without a call line)', () => {
    // R2-F: CO to act facing UTG open; map has 3bet + fold but no call.
    const node: PreflopV2Node = {
      _meta: { preflop_actions: 'R2-F', actor: 'co' },
      game_info: { players: players('CO', ['HJ']) },
      actions_legend: { F: 'fold', 'R6.5': 'raise (6.5bb)' },
      hands: {},
    };
    const html = renderToStaticMarkup(
      <PositionActionGrid config="c" node={node} index={idx({ R2_F: { F: 'R2_F_F', 'R6.5': 'R2_F_R6_5' } })} />,
    );
    expect(html).toContain('3bet'); // raise (1 prior raise) shown red
    expect(html).toContain('call'); // call slot present...
    expect(html.toUpperCase()).toContain('B4B2A9'); // ...but greyed (not reachable)
    expect(html.toUpperCase()).toContain('D8443C'); // 3bet red
  });

  it('3bet reachable only via skip-connect is still colored (2.5x bug regression)', () => {
    // map already carries the skip-resolved target -> 3bet must render red, not grey.
    const node: PreflopV2Node = {
      _meta: { preflop_actions: 'R2-F', actor: 'co' },
      game_info: { players: players('CO', ['HJ']) },
      actions_legend: { F: 'fold', 'R6.5': 'raise (6.5bb)' },
      hands: {},
    };
    // skip-connected deep target
    const html = renderToStaticMarkup(
      <PositionActionGrid config="c" node={node} index={idx({ R2_F: { F: 'R2_F_F', 'R6.5': 'R2_F_R6_5_F_F_F' } })} />,
    );
    expect(html).toContain('3bet');
    expect(html.toUpperCase()).toContain('D8443C'); // colored, not grey
  });

  it('always shows all 4 frames; absent actions are greyed', () => {
    const node: PreflopV2Node = {
      _meta: { preflop_actions: 'R2-F', actor: 'co' },
      game_info: { players: players('CO', ['HJ']) },
      actions_legend: { F: 'fold', C: 'call (2bb)' },
      hands: {},
    };
    const html = renderToStaticMarkup(
      <PositionActionGrid config="c" node={node} index={idx({ R2_F: { F: 'R2_F_F', C: 'R2_F_C' } })} />,
    );
    expect(html).toContain('All-in'); // allin slot present
    expect(html).toContain('3bet'); // raise slot present
    expect(html).toContain('call');
    expect(html).toContain('fold');
    expect(html.toUpperCase()).toContain('B4B2A9'); // allin + raise greyed (absent)
    expect(html.toUpperCase()).toContain('3B8A1E'); // call available -> green
  });
});

// --- セル判定を席ごとに独立して行うこと + 自動 fold 補完の遷移先検証 ---
// 実 R2 データ (cash_100bb_6max_nl500_gto) の該当部分を抜粋した fixture。
describe('buildGridColumns: 各ポジション × 各アクションの遷移先', () => {
  const NODES: Record<string, Record<string, string>> = {
    root: { F: 'F', R2: 'R2' },
    F: { F: 'F_F', R2: 'F_R2' },
    F_F: { F: 'F_F_F', 'R2.3': 'F_F_R2_3' },
    F_F_F: { F: 'F_F_F_F', 'R2.5': 'F_F_F_R2_5' },
    F_F_F_F: { C: 'F_F_F_F_C', R3: 'F_F_F_F_R3' },
    R2: { F: 'R2_F', 'R6.5': 'R2_R6_5' },
    R2_F: { F: 'R2_F_F', C: 'R2_F_C', 'R6.5': 'R2_F_R6_5' },
    R2_F_F: { F: 'R2_F_F_F', C: 'R2_F_F_C', 'R7.5': 'R2_F_F_R7_5' },
    R2_F_F_F: { F: 'R2_F_F_F_F', C: 'R2_F_F_F_C', R10: 'R2_F_F_F_R10' },
    R2_F_F_F_F: { R12: 'R2_F_F_F_F_R12' },
    R2_R6_5: { F: 'R2_R6_5_F', R14: 'R2_R6_5_R14' },
    R2_R6_5_F: { F: 'R2_R6_5_F_F', R14: 'R2_R6_5_F_R14' },
    R2_R6_5_F_F: { F: 'R2_R6_5_F_F_F', R20: 'R2_R6_5_F_F_R20', RAI: 'R2_R6_5_F_F_RAI' },
    R2_R6_5_F_F_F: { F: 'R2_R6_5_F_F_F_F', R19: 'R2_R6_5_F_F_F_R19', RAI: 'R2_R6_5_F_F_F_RAI' },
    R2_R6_5_F_F_F_F: { R19: 'R2_R6_5_F_F_F_F_R19', RAI: 'R2_R6_5_F_F_F_F_RAI' },
  };
  const index = idx(NODES);

  function cellsOf(chain: string, hero: string, folded: string[]) {
    const node: PreflopV2Node = {
      _meta: { preflop_actions: chain, actor: hero.toLowerCase() },
      game_info: { players: players(hero, folded) },
      actions_legend: {},
      hands: {},
    };
    const out: Record<string, Record<string, { label?: string; to?: string | null; grey: boolean }>> = {};
    for (const col of buildGridColumns(node, index)) {
      out[col.seat] = {};
      (['allin', 'raise', 'call', 'fold'] as const).forEach((rk, i) => {
        const c = col.cells[i];
        out[col.seat][rk] = { label: c.label, to: c.toStem, grey: c.kind !== 'action' };
      });
    }
    return out;
  }

  it('root: UTG〜SB の open が全て色付きで、正しい stem に遷移する', () => {
    const g = cellsOf('', 'UTG', []);
    expect(g.UTG.raise).toMatchObject({ label: 'open', to: 'R2', grey: false });
    expect(g.HJ.raise).toMatchObject({ label: 'open', to: 'F_R2', grey: false });
    expect(g.CO.raise).toMatchObject({ label: 'open', to: 'F_F_R2_3', grey: false });
    expect(g.BTN.raise).toMatchObject({ label: 'open', to: 'F_F_F_R2_5', grey: false });
    expect(g.SB.raise).toMatchObject({ label: 'open', to: 'F_F_F_F_R3', grey: false });
    // SB はリンプ可能、BB は root では手番が来ないので全グレー。
    expect(g.SB.call).toMatchObject({ label: 'limp', to: 'F_F_F_F_C', grey: false });
    expect(g.BB.raise.grey).toBe(true);
  });

  it('R2 (UTG open 直後、HJ の手番): 全席の 3bet が色付きで、間の fold が自動補完される', () => {
    const g = cellsOf('R2', 'HJ', []);
    expect(g.HJ.raise).toMatchObject({ label: '3bet', to: 'R2_R6_5', grey: false });
    expect(g.CO.raise).toMatchObject({ label: '3bet', to: 'R2_F_R6_5', grey: false });
    expect(g.BTN.raise).toMatchObject({ label: '3bet', to: 'R2_F_F_R7_5', grey: false });
    expect(g.SB.raise).toMatchObject({ label: '3bet', to: 'R2_F_F_F_R10', grey: false });
    expect(g.BB.raise).toMatchObject({ label: '3bet', to: 'R2_F_F_F_F_R12', grey: false });
    // UTG は open 済みで、以降手番が回らない (全員 fold なら UTG の勝ち) → 確定表示。
    expect(g.UTG.raise).toMatchObject({ label: 'open', grey: true });
    // HJ の call はデータに無いのでグレー、CO〜SB の call は色付き。
    expect(g.HJ.call.grey).toBe(true);
    expect(g.CO.call).toMatchObject({ to: 'R2_F_C', grey: false });
    expect(g.BTN.call).toMatchObject({ to: 'R2_F_F_C', grey: false });
    expect(g.SB.call).toMatchObject({ to: 'R2_F_F_F_C', grey: false });
  });

  it('R2-R6.5 (HJ 3bet 直後、CO の手番): 4bet が色付き、UTG の 2 回目の手番も出る', () => {
    const g = cellsOf('R2-R6.5', 'CO', []);
    expect(g.CO.raise).toMatchObject({ label: '4bet', to: 'R2_R6_5_R14', grey: false });
    expect(g.BTN.raise).toMatchObject({ label: '4bet', to: 'R2_R6_5_F_R14', grey: false });
    expect(g.SB.raise).toMatchObject({ label: '4bet', to: 'R2_R6_5_F_F_R20', grey: false });
    expect(g.BB.raise).toMatchObject({ label: '4bet', to: 'R2_R6_5_F_F_F_R19', grey: false });
    // 案X の本体: UTG は open 済みだが CO/BTN/SB/BB が fold すると再び手番。
    expect(g.UTG.raise).toMatchObject({ label: '4bet', to: 'R2_R6_5_F_F_F_F_R19', grey: false });
    expect(g.UTG.allin).toMatchObject({ label: 'All-in', to: 'R2_R6_5_F_F_F_F_RAI', grey: false });
    // HJ は 3bet 済みで、この先 4bet に応じる局面のノードが無い → 確定表示のまま。
    expect(g.HJ.raise).toMatchObject({ label: '3bet', grey: true });
  });

  it('降りた席は再手番が無いので確定 fold のまま (2 回目の手番と混同しない)', () => {
    const g = cellsOf('R2-F', 'CO', ['HJ']);
    expect(g.HJ.fold).toMatchObject({ label: 'fold', grey: true });
    expect(g.HJ.raise.label).toBeUndefined(); // 空セル
  });
});
