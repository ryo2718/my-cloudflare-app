import { describe, it, expect } from 'vitest';
import {
  computeAllinNodePath,
  computeRaisedNodePath,
  getValidResponders,
  initialLeftNodePath,
  initialRightNodePath,
  isAvailableNodePath,
} from './scenarios';

describe('computeRaisedNodePath', () => {
  it('vs RFI から 3bet path を作る', () => {
    expect(computeRaisedNodePath('utgr_bb', 'UTG')).toBe('utgr_bbr_utg');
  });
  it('深い path にも対応', () => {
    expect(computeRaisedNodePath('utgr_hjr_utg', 'HJ')).toBe('utgr_hjr_utgr_hj');
  });
});

describe('computeAllinNodePath', () => {
  it('vs RFI から all-in path を作る', () => {
    expect(computeAllinNodePath('utgr_bb', 'UTG')).toBe('utgr_bbai_utg');
  });
  it('limp 経路 (sbc_bb) からの all-in も成立', () => {
    expect(computeAllinNodePath('sbc_bb', 'SB')).toBe('sbc_bbai_sb');
  });
});

describe('initialLeftNodePath', () => {
  it.each([
    ['UTG', 'utg'],
    ['HJ', 'hj'],
    ['CO', 'co'],
    ['BTN', 'btn'],
    ['SB', 'sb'],
  ] as const)('%s → %s', (opener, expected) => {
    expect(initialLeftNodePath(opener)).toBe(expected);
  });
});

describe('initialRightNodePath', () => {
  it('default (open) は opener_r_responder', () => {
    expect(initialRightNodePath('UTG', 'BB')).toBe('utgr_bb');
    expect(initialRightNodePath('HJ', 'CO')).toBe('hjr_co');
  });

  it('open を明示しても同じ結果', () => {
    expect(initialRightNodePath('UTG', 'BB', 'open')).toBe('utgr_bb');
  });

  it('SB + BB + limp だけ sbc_bb (回帰防止)', () => {
    expect(initialRightNodePath('SB', 'BB', 'limp')).toBe('sbc_bb');
  });

  it('SB 以外で limp を渡しても通常 path (副作用なし)', () => {
    // ガード: limp は SB 専用なので、UTG+BB+limp は普通の utgr_bb のまま
    expect(initialRightNodePath('UTG', 'BB', 'limp')).toBe('utgr_bb');
  });

  it('SB + 非 BB + limp も通常 path (sbc_* は BB 相手のみ)', () => {
    expect(initialRightNodePath('SB', 'CO', 'limp')).toBe('sbr_co');
  });
});

describe('getValidResponders', () => {
  it('UTG opener → UTG より後ろの席を返す (BB を最初に出す逆順)', () => {
    const r = getValidResponders('UTG');
    // 実装は POSITION_ORDER.slice(idx+1).reverse() = BB, SB, BTN, CO, HJ
    expect(r).toEqual(['BB', 'SB', 'BTN', 'CO', 'HJ']);
  });
  it('SB opener → BB のみ', () => {
    expect(getValidResponders('SB')).toEqual(['BB']);
  });
  it('BTN opener → BB, SB', () => {
    expect(getValidResponders('BTN')).toEqual(['BB', 'SB']);
  });
});

describe('isAvailableNodePath', () => {
  it('既存の RFI ノード is available', () => {
    expect(isAvailableNodePath('utg')).toBe(true);
    expect(isAvailableNodePath('sb')).toBe(true);
  });
  it('既存の sbc_* (limp ツリー) is available', () => {
    // sbc_bb / sbc_bbr_sb 等は manifest 登録済 (8 ファイル)
    expect(isAvailableNodePath('sbc_bb')).toBe(true);
    expect(isAvailableNodePath('sbc_bbr_sb')).toBe(true);
    expect(isAvailableNodePath('sbc_bbr_sbr_bbr_sb')).toBe(true);
  });
  it('存在しない path は false', () => {
    expect(isAvailableNodePath('nonexistent_node')).toBe(false);
    expect(isAvailableNodePath('hjr_utg')).toBe(false); // 物理的に到達不能
  });
});
