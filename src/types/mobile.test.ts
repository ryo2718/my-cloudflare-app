import { describe, it, expect } from 'vitest';
import {
  canSelectAsOpener,
  canSelectAsResponder,
  countRaises,
  createInitialState,
  heroFromPath,
  nextRaiseLabel,
  oppositeHero,
} from './mobile';

describe('createInitialState', () => {
  it('opener=null / openerAction=open / responder=null / historyPaths=[]', () => {
    const s = createInitialState();
    expect(s.opener).toBeNull();
    expect(s.openerAction).toBe('open');
    expect(s.responder).toBeNull();
    expect(s.historyPaths).toEqual([]);
  });
});

describe('canSelectAsOpener', () => {
  it('BB は opener になれない', () => {
    expect(canSelectAsOpener('BB')).toBe(false);
  });
  it('UTG/HJ/CO/BTN/SB は opener OK', () => {
    for (const p of ['UTG', 'HJ', 'CO', 'BTN', 'SB'] as const) {
      expect(canSelectAsOpener(p)).toBe(true);
    }
  });
});

describe('canSelectAsResponder', () => {
  it('opener=null は常に false', () => {
    expect(canSelectAsResponder(null, 'BB')).toBe(false);
  });
  it('opener と同じ pos は不可', () => {
    expect(canSelectAsResponder('HJ', 'HJ')).toBe(false);
  });
  it('opener より前の席は不可 (バグ予防)', () => {
    // POSITION_ORDER = UTG, HJ, CO, BTN, SB, BB
    expect(canSelectAsResponder('HJ', 'UTG')).toBe(false);
    expect(canSelectAsResponder('CO', 'HJ')).toBe(false);
    expect(canSelectAsResponder('SB', 'BTN')).toBe(false);
  });
  it('opener より後ろの席は OK', () => {
    expect(canSelectAsResponder('UTG', 'HJ')).toBe(true);
    expect(canSelectAsResponder('UTG', 'BB')).toBe(true);
    expect(canSelectAsResponder('SB', 'BB')).toBe(true);
  });
});

describe('heroFromPath', () => {
  it('末尾セグメントを大文字 Position にする', () => {
    expect(heroFromPath('utg')).toBe('UTG');
    expect(heroFromPath('utgr_bb')).toBe('BB');
    expect(heroFromPath('sbc_bb')).toBe('BB');
    expect(heroFromPath('hjr_sbr_hjr_sbr_hj')).toBe('HJ');
  });
});

describe('oppositeHero', () => {
  it('現在 hero が opener なら responder を返す', () => {
    expect(oppositeHero('UTG', 'UTG', 'BB')).toBe('BB');
  });
  it('現在 hero が responder なら opener を返す', () => {
    expect(oppositeHero('BB', 'UTG', 'BB')).toBe('UTG');
  });
});

describe('countRaises', () => {
  it('r で終わる segment 数を数える', () => {
    expect(countRaises('utg')).toBe(0);
    expect(countRaises('utgr_bb')).toBe(1);
    expect(countRaises('utgr_bbr_utg')).toBe(2);
    expect(countRaises('utgr_bbr_utgr_bb')).toBe(3);
  });
  it('limp segment (c) は raise としてカウントしない', () => {
    expect(countRaises('sbc_bb')).toBe(0);
    expect(countRaises('sbc_bbr_sb')).toBe(1); // BB iso-raise が 1 raise
  });
  it('all-in segment (ai) も raise としてカウントしない (ai は r で終わらない)', () => {
    expect(countRaises('utgr_bbai_utg')).toBe(1); // utgr の 1 個だけ
  });
});

describe('nextRaiseLabel', () => {
  it('通常 (limp 無し) — 段数別ラベル', () => {
    expect(nextRaiseLabel('utg')).toBe('open');
    expect(nextRaiseLabel('utgr_bb')).toBe('3bet');
    expect(nextRaiseLabel('utgr_bbr_utg')).toBe('4bet');
    expect(nextRaiseLabel('utgr_bbr_utgr_bb')).toBe('5bet');
  });
  it('limp pot の最初の iso-raise は "raise" (= "open" にしない、回帰防止)', () => {
    // sbc_bb で BB が iso-raise する → "open" ではなく "raise"
    expect(nextRaiseLabel('sbc_bb')).toBe('raise');
  });
  it('limp 経路の 2 段以降は通常 3bet/4bet 表記', () => {
    expect(nextRaiseLabel('sbc_bbr_sb')).toBe('3bet');
    expect(nextRaiseLabel('sbc_bbr_sbr_bb')).toBe('4bet');
  });
});
