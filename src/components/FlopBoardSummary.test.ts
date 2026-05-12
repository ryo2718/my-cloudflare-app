// FlopBoardSummary の純関数部分のテスト。
// determineWinner: EV 比較で勝者判定 (UI 改修で導入)。
//
// UI render は手動確認方針 (案 A) のため、ここでは pure logic だけテスト。

import { describe, it, expect } from 'vitest';
import { determineWinner } from './FlopBoardSummary.helpers';

describe('determineWinner', () => {
  it('OOP の EV が大なら OOP wins', () => {
    expect(determineWinner(2.78, 2.76)).toEqual({ oopWins: true, ipWins: false });
  });

  it('IP の EV が大なら IP wins', () => {
    expect(determineWinner(1.5, 3.0)).toEqual({ oopWins: false, ipWins: true });
  });

  it('EV 同値ならニュートラル (両方 false)', () => {
    expect(determineWinner(2.5, 2.5)).toEqual({ oopWins: false, ipWins: false });
  });

  it('OOP EV が null ならニュートラル', () => {
    expect(determineWinner(null, 2.5)).toEqual({ oopWins: false, ipWins: false });
  });

  it('IP EV が null ならニュートラル', () => {
    expect(determineWinner(2.5, null)).toEqual({ oopWins: false, ipWins: false });
  });

  it('両方 null ならニュートラル', () => {
    expect(determineWinner(null, null)).toEqual({ oopWins: false, ipWins: false });
  });

  it('undefined も null と同等に扱う', () => {
    expect(determineWinner(undefined, 2.5)).toEqual({ oopWins: false, ipWins: false });
    expect(determineWinner(2.5, undefined)).toEqual({ oopWins: false, ipWins: false });
  });

  it('負の EV でも比較は正常 (より大きい方が wins)', () => {
    expect(determineWinner(-0.5, -1.2)).toEqual({ oopWins: true, ipWins: false });
    expect(determineWinner(-3.0, -2.0)).toEqual({ oopWins: false, ipWins: true });
  });

  it('微小差 (0.001) でも勝敗判定する', () => {
    expect(determineWinner(2.501, 2.500)).toEqual({ oopWins: true, ipWins: false });
  });
});
