import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PositionActionGrid } from './PositionActionGrid';
import type { PreflopV2Index, PreflopV2Node } from '../../data/preflopV2/types';

function idx(nodes: Record<string, string[]>): PreflopV2Index {
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
  it('renders all 6 columns, focuses the actor, names the open, shows committed folds', () => {
    const node: PreflopV2Node = {
      _meta: { preflop_actions: 'F-F-F', actor: 'btn' },
      game_info: { players: players('BTN', ['UTG', 'HJ', 'CO']) },
      actions_legend: { F: 'fold (0bb)', 'R2.5': 'raise (2.5bb)' },
      hands: {},
    };
    const html = renderToStaticMarkup(
      <PositionActionGrid config="c" node={node} index={idx({ F_F_F: ['F_F_F_F', 'F_F_F_R2_5'] })} />,
    );
    for (const p of ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']) expect(html).toContain(p);
    expect(html).toContain('open'); // raise named open (0 prior raises)
    expect(html).toContain('fold');
    // committed folds are grey auto-fold; focus column has the red border
    expect(html.toUpperCase()).toContain('B4B2A9'); // auto-fold grey
    expect(html.toUpperCase()).toContain('842821'); // focus border
    expect(html.toUpperCase()).toContain('D8443C'); // open = raise red
  });

  it('shows allin cell in purple when RAI is available', () => {
    const node: PreflopV2Node = {
      _meta: { preflop_actions: 'F-F-F-R2.5-R12', actor: 'btn' },
      game_info: { players: players('BB', ['UTG', 'HJ', 'CO']) },
      actions_legend: { F: 'fold', C: 'call (12bb)', RAI: 'all-in raise (100bb)' },
      hands: {},
    };
    const stem = 'F_F_F_R2_5_R12';
    const html = renderToStaticMarkup(
      <PositionActionGrid config="c" node={node} index={idx({ [stem]: [`${stem}_F`, `${stem}_C`, `${stem}_RAI`] })} />,
    );
    expect(html).toContain('All-in');
    expect(html.toUpperCase()).toContain('534AB7'); // allin purple from ACTION_COLOR
  });
});
