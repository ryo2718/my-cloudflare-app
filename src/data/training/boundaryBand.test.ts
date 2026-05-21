import { describe, it, expect } from 'vitest';
import {
  familyOf,
  kickerVal,
  participatePct,
  extractFamilyBand,
  extractBoundaryBand,
  collapseToSlots,
  pickFromSlot,
} from './boundaryBand';
import type { HandStrategy } from './preflopBeginner';

function s(participate: number, raise = participate): HandStrategy {
  // participate% = 100 - fold。raise は表示確認用 (band 抽出には未使用)。
  return { fold: 100 - participate, call: 0, raise, allin: 0 };
}

describe('familyOf / kickerVal', () => {
  it('ペアは pair、スーテッド/オフは 高位+s|o', () => {
    expect(familyOf('AA')).toBe('pair');
    expect(familyOf('AKs')).toBe('As');
    expect(familyOf('KJo')).toBe('Ko');
    expect(familyOf('98s')).toBe('9s');
  });
  it('kickerVal は弱いほど大 (A=0)', () => {
    expect(kickerVal('AKs')).toBeLessThan(kickerVal('A2s'));
    expect(kickerVal('AA')).toBeLessThan(kickerVal('22'));
  });
  it('participatePct = 100 - fold', () => {
    expect(participatePct({ fold: 87, call: 0, raise: 13, allin: 0 })).toBe(13);
  });
});

describe('extractFamilyBand (境界帯)', () => {
  it('Axs: 最弱の100%参加(A3s)〜ファミリー最弱(A2s, 13%) を返す', () => {
    const hands: Record<string, HandStrategy> = {
      AKs: s(100), AQs: s(100), AJs: s(100), ATs: s(100), A9s: s(100),
      A8s: s(100), A7s: s(100), A6s: s(100), A5s: s(100), A4s: s(100),
      A3s: s(100), A2s: s(13, 13),
    };
    expect(extractFamilyBand(hands, 'As')).toEqual(['A3s', 'A2s']);
  });

  it('Kxs: K9s(100%)〜最初の0%参加(K4s) まで (両端含む)', () => {
    const hands: Record<string, HandStrategy> = {
      KQs: s(100), KJs: s(100), KTs: s(100), K9s: s(100), K8s: s(96, 96),
      K7s: s(41, 41), K6s: s(41, 41), K5s: s(30, 30), K4s: s(0, 0),
      K3s: s(0, 0), K2s: s(0, 0),
    };
    expect(extractFamilyBand(hands, 'Ks')).toEqual(['K9s', 'K8s', 'K7s', 'K6s', 'K5s', 'K4s']);
  });

  it('ペア: 66(100%)〜最弱(22, 37.5%)', () => {
    const hands: Record<string, HandStrategy> = {
      AA: s(100), KK: s(100), QQ: s(100), JJ: s(100), TT: s(100),
      99: s(100), 88: s(100), 77: s(100), 66: s(100),
      55: s(48), 44: s(31.5), 33: s(30), 22: s(37.5),
    };
    expect(extractFamilyBand(hands, 'pair')).toEqual(['66', '55', '44', '33', '22']);
  });

  it('≈100%参加が無ければ空配列', () => {
    const hands: Record<string, HandStrategy> = { A5s: s(40), A4s: s(20), A3s: s(0) };
    expect(extractFamilyBand(hands, 'As')).toEqual([]);
  });
});

describe('extractBoundaryBand (全ファミリー結合)', () => {
  it('複数ファミリーの境界帯を全て含む', () => {
    const hands: Record<string, HandStrategy> = {
      AKs: s(100), AQs: s(50), AJs: s(0),
      AA: s(100), KK: s(40), QQ: s(0),
    };
    const band = extractBoundaryBand(hands);
    expect(band).toContain('AKs');
    expect(band).toContain('AQs');
    expect(band).toContain('AJs');
    expect(band).toContain('AA');
    expect(band).toContain('KK');
    expect(band).toContain('QQ');
  });
});

describe('collapseToSlots / pickFromSlot (KJ 1枠化)', () => {
  it('同2ランクの suited/offsuit を1枠に統合、ペアは各1枠', () => {
    const slots = collapseToSlots(['KJs', 'KJo', 'AA', '72s']);
    expect(slots).toContainEqual(['KJs', 'KJo']);
    expect(slots).toContain('AA');
    expect(slots).toContain('72s'); // 72o が無いので単独
    expect(slots).toHaveLength(3);
  });

  it('pickFromSlot: 1枠は両方のどちらか、単独はそのまま', () => {
    for (let i = 0; i < 30; i++) {
      const picked = pickFromSlot(['KJs', 'KJo']);
      expect(['KJs', 'KJo']).toContain(picked);
    }
    expect(pickFromSlot('AA')).toBe('AA');
  });
});
