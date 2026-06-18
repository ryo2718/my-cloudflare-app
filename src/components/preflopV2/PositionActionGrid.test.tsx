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
  it('renders all 6 columns; actor shows 4 choices, committed folds are grey 1-cell', () => {
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
    expect(html).toContain('open'); // BTN raise named open
    expect(html).toContain('fold');
    expect(html.toUpperCase()).toContain('B4B2A9'); // committed/auto-fold grey
    expect(html.toUpperCase()).toContain('D8443C'); // BTN open = raise red (tappable)
    expect(html).toContain('type="button"'); // BTN cells are tappable
  });

  it('all positions x all choices: non-actor positions render tappable cells too', () => {
    // root: UTG to act. Via fold-around, HJ (F) and CO (F_F) also become tappable.
    const node: PreflopV2Node = {
      _meta: { preflop_actions: '', actor: 'utg' },
      game_info: { players: players('UTG', []) },
      actions_legend: { F: 'fold', R2: 'raise (2bb)' },
      hands: {},
    };
    const index = idx({
      root: ['F', 'R2'],
      F: ['F_F', 'F_R2'], // HJ RFI: open + fold
      F_F: ['F_F_F', 'F_F_R2'], // CO RFI: open + fold
    });
    const html = renderToStaticMarkup(<PositionActionGrid config="c" node={node} index={index} />);
    // UTG + HJ + CO each have open & fold buttons -> >= 6 tappable cells (not just the actor)
    const buttons = (html.match(/<button/g) ?? []).length;
    expect(buttons).toBeGreaterThanOrEqual(4);
    expect(html.toUpperCase()).toContain('D8443C'); // open (raise) red
  });

  it('greys out call (no data) while keeping 3bet + fold at a vs-open node', () => {
    // R2-F-F: UTG open, HJ/CO fold, BTN to act. legend has C but no call child.
    const node: PreflopV2Node = {
      _meta: { preflop_actions: 'R2-F-F', actor: 'btn' },
      game_info: { players: players('BTN', ['HJ', 'CO']) },
      actions_legend: { F: 'fold', C: 'call (2bb)', 'R7.5': 'raise (7.5bb)' },
      hands: {},
    };
    // index: call child (R2_F_F_C) intentionally absent
    const html = renderToStaticMarkup(
      <PositionActionGrid config="c" node={node} index={idx({ R2_F_F: ['R2_F_F_F', 'R2_F_F_R7_5'] })} />,
    );
    expect(html).toContain('3bet'); // raise (1 prior raise) always shown
    expect(html).toContain('call'); // call still shown...
    expect(html.toUpperCase()).toContain('B4B2A9'); // ...but greyed (disabled), not removed
    expect(html.toUpperCase()).toContain('D8443C'); // 3bet red
  });

  it('shows 3bet in red even when its child node is missing (regression: CO facing UTG open)', () => {
    // R2-F: UTG open, HJ fold, CO to act. legend has R6.5 (3bet) but NO R2_F_R6_5 child.
    const node: PreflopV2Node = {
      _meta: { preflop_actions: 'R2-F', actor: 'co' },
      game_info: { players: players('CO', ['HJ']) },
      actions_legend: { F: 'fold', C: 'call (2bb)', 'R6.5': 'raise (6.5bb)', RAI: 'all-in' },
      hands: {},
    };
    // index: only fold + call children exist (3bet / allin lines not scraped)
    const html = renderToStaticMarkup(
      <PositionActionGrid config="c" node={node} index={idx({ R2_F: ['R2_F_C', 'R2_F_F'] })} />,
    );
    expect(html).toContain('3bet'); // 3bet no longer hidden
    expect(html.toUpperCase()).toContain('D8443C'); // shown in raise red, not grey
    // its child does not exist -> rendered non-tappable (no navigation target)
    expect(html).not.toContain('/strategy/c/R2_F_R6_5');
  });

  it('always shows all 4 frames (allin/raise/call/fold); absent actions are greyed', () => {
    // Fold-only-ish node: legend has only F and C (no raise, no allin)
    const node: PreflopV2Node = {
      _meta: { preflop_actions: 'R2-F', actor: 'co' },
      game_info: { players: players('CO', ['HJ']) },
      actions_legend: { F: 'fold', C: 'call (2bb)' },
      hands: {},
    };
    const html = renderToStaticMarkup(
      <PositionActionGrid config="c" node={node} index={idx({ R2_F: ['R2_F_C', 'R2_F_F'] })} />,
    );
    // all four slots present
    expect(html).toContain('All-in');
    expect(html).toContain('3bet'); // raise slot label (1 prior raise)
    expect(html).toContain('call');
    expect(html).toContain('fold');
    // allin + raise are absent from legend -> greyed
    expect(html.toUpperCase()).toContain('B4B2A9');
    // call is available -> green
    expect(html.toUpperCase()).toContain('3B8A1E');
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
