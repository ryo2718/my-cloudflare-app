import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextActionButtons } from './NextActionButtons';
import type { PreflopV2Index, PreflopV2Node } from '../../data/preflopV2/types';

const index: PreflopV2Index = {
  config: 'c',
  label: 'L',
  stackBb: 100,
  rake: 'NL500',
  openSize: 'gto',
  positionOrder: ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  entries: {},
  nodes: { F_R2_R6_5: ['F_R2_R6_5_C', 'F_R2_R6_5_F'] },
};

const node: PreflopV2Node = {
  _meta: { preflop_actions: 'F-R2-R6.5', actor: 'utg' },
  game_info: {},
  actions_legend: { F: 'fold (0bb)', C: 'call (6.5bb)', RAI: 'all-in raise (100bb)' },
  hands: {},
};

describe('NextActionButtons', () => {
  it('renders the actor and only navigable actions (terminal RAI omitted)', () => {
    const html = renderToStaticMarkup(
      <NextActionButtons config="c" node={node} index={index} />,
    );
    expect(html).toContain('fold (0bb)');
    expect(html).toContain('call (6.5bb)');
    expect(html).not.toContain('all-in raise (100bb)'); // no child node -> excluded
    expect(html).toContain('UTG'); // actor badge
  });

  it('shows a leaf message when there are no children', () => {
    const leafNode: PreflopV2Node = {
      _meta: { preflop_actions: 'Z', actor: 'bb' },
      game_info: {},
      actions_legend: { F: 'fold' },
      hands: {},
    };
    const html = renderToStaticMarkup(
      <NextActionButtons config="c" node={leafNode} index={index} />,
    );
    expect(html).toContain('リーフ');
  });
});
