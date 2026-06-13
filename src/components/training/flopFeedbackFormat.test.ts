// フロップ即時FB: ベット表示(bet/pot %) + バー色(check=緑/赤グラデ/紫)。

import { describe, it, expect } from 'vitest';
import { actionFreqLabel, barColor, flopJudgment, feedbackRows, potPillColor } from './flopFeedbackFormat';
import { judgmentIcon } from './judgmentIcon';
import { ACTION_COLOR } from '../../styles/actionColors';

describe('actionFreqLabel (修正1: bet/pot %)', () => {
  it('ベットは bet/pot の % で表示', () => {
    expect(actionFreqLabel('R1.8', 0.327)).toBe('ベット 33%');
    expect(actionFreqLabel('R2.75', 0.5)).toBe('ベット 50%');
    expect(actionFreqLabel('R4.1', 0.745)).toBe('ベット 75%');
  });
  it('チェック / オールイン', () => {
    expect(actionFreqLabel('X', 0)).toBe('チェック');
    expect(actionFreqLabel('RAI', 2.0)).toBe('オールイン');
  });
});

describe('barColor (修正2: check=緑 / 赤グラデ / 紫)', () => {
  it('チェックは緑 (= ACTION_COLOR.check = call と同色)', () => {
    expect(barColor('X', 0)).toBe(ACTION_COLOR.check);
    expect(ACTION_COLOR.check).toBe('#3B8A1E');
  });
  it('ポットオーバー (>100%) は紫', () => {
    expect(barColor('R12', 1.2)).toBe(ACTION_COLOR.allin);
    expect(barColor('RAI', 2.0)).toBe(ACTION_COLOR.allin);
  });
  it('通常ベットは赤系 (サイズで濃淡)', () => {
    const small = barColor('R1.8', 0.33);
    const large = barColor('R5', 0.95);
    expect(small).toMatch(/^hsl\(2,/); // 赤系
    expect(large).toMatch(/^hsl\(2,/);
    expect(small).not.toBe(large); // サイズで濃淡が変わる
  });
});

describe('feedbackRows (チェックは0%でも常時表示)', () => {
  it('チェックがデータに無くても 0% で先頭に出す', () => {
    const rows = feedbackRows([{ code: 'R5', freq: 0.9, bp: 0.5 }]);
    expect(rows[0]).toEqual({ code: 'X', freq: 0, bp: 0 });
    expect(rows.map((r) => r.code)).toEqual(['X', 'R5']);
  });
  it('チェックが0%でも残す。ベットの0%は除外', () => {
    const rows = feedbackRows([
      { code: 'X', freq: 0, bp: 0 },
      { code: 'R2', freq: 0.7, bp: 0.33 },
      { code: 'R5', freq: 0.002, bp: 0.9 }, // 四捨五入0% → 除外
    ]);
    expect(rows.map((r) => r.code)).toEqual(['X', 'R2']);
    expect(rows[0].freq).toBe(0); // チェック0%でも表示
  });
});

describe('potPillColor (SRP=クリーム / 3bp=赤系オレンジ、紫は使わない)', () => {
  it('SRP は濃いめクリーム、3bp は赤系オレンジ', () => {
    expect(potPillColor('SRP')).toEqual({ bg: '#FAC775', fg: '#412402' });
    expect(potPillColor('3bet')).toEqual({ bg: '#DD5A2E', fg: '#ffffff' });
  });
  it('紫 (オールイン/ポットオーバー専用) を使わない', () => {
    expect(potPillColor('SRP').bg).not.toBe(ACTION_COLOR.allin);
    expect(potPillColor('3bet').bg).not.toBe(ACTION_COLOR.allin);
  });
});

describe('flopJudgment (修正2: 1pt→○ / 0pt→×、△は使わない)', () => {
  it('1pt(正解)→○ / 0pt(不正解)→×', () => {
    expect(flopJudgment(1)).toBe('○');
    expect(flopJudgment(0)).toBe('✕');
  });
  it('他モードの judgmentIcon は不変 (0pt→△ のまま)', () => {
    expect(judgmentIcon(0)).toBe('△'); // 部分点モードは従来どおり
    expect(judgmentIcon(2)).toBe('◎');
    expect(judgmentIcon(1)).toBe('○');
    expect(judgmentIcon(-1)).toBe('✕');
  });
});
