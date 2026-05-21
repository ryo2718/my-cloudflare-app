import { describe, it, expect } from 'vitest';
import { parseActionHistory, toSeatPopups, actionLabel } from './actionHistory';

describe('parseActionHistory', () => {
  it('Raise/Fold/Allin を額つきで解析', () => {
    const items = parseActionHistory([
      { position: 'UTG', action: 'Raise 2.5' },
      { position: 'HJ', action: 'Fold' },
      { position: 'CO', action: 'Allin 100' },
    ]);
    expect(items).toEqual([
      { position: 'UTG', kind: 'raise', amount: 2.5 },
      { position: 'HJ', kind: 'fold' },
      { position: 'CO', kind: 'allin', amount: 100 },
    ]);
  });

  it('Call はレイズ前なら limp、レイズ後なら call', () => {
    // SB が最初に Call → limp
    const limp = parseActionHistory([
      { position: 'UTG', action: 'Fold' },
      { position: 'SB', action: 'Call' },
    ]);
    expect(limp[1]).toEqual({ position: 'SB', kind: 'limp' });

    // レイズ後の Call → call
    const call = parseActionHistory([
      { position: 'UTG', action: 'Raise 2.5' },
      { position: 'BB', action: 'Call' },
    ]);
    expect(call[1]).toEqual({ position: 'BB', kind: 'call' });
  });
});

describe('actionLabel', () => {
  it('raise は額つき、その他は語のみ', () => {
    expect(actionLabel({ position: 'UTG', kind: 'raise', amount: 2.5 })).toBe('raise 2.5');
    expect(actionLabel({ position: 'HJ', kind: 'raise', amount: 12 })).toBe('raise 12');
    expect(actionLabel({ position: 'CO', kind: 'fold' })).toBe('fold');
    expect(actionLabel({ position: 'SB', kind: 'limp' })).toBe('limp');
    expect(actionLabel({ position: 'BB', kind: 'call' })).toBe('call');
    expect(actionLabel({ position: 'BTN', kind: 'allin', amount: 100 })).toBe('allin');
  });
});

describe('toSeatPopups', () => {
  it('同一ポジションの複数行動は最新を採用', () => {
    const items = parseActionHistory([
      { position: 'UTG', action: 'Raise 2.5' },
      { position: 'HJ', action: 'Raise 7.5' },
      { position: 'UTG', action: 'Raise 20' },
    ]);
    const popups = toSeatPopups(items);
    const utg = popups.find((p) => p.position === 'UTG');
    expect(utg?.label).toBe('raise 20');
    expect(popups).toHaveLength(2); // UTG, HJ
  });
});
