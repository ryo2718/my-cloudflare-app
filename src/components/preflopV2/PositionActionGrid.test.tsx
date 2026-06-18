import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PositionActionGrid } from './PositionActionGrid';
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
