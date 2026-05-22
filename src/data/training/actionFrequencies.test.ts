import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { presentNodeActions, handActionFrequencies, actionBarColor, barWidthPct, type FreqMap } from './actionFrequencies';

// CO open 風 (raise/fold のみ存在)。
const coOpen: Record<string, FreqMap> = {
  AA: { allin: 0, raise: 100, call: 0, fold: 0 },
  '22': { allin: 0, raise: 56, call: 0, fold: 44 },
  '72o': { allin: 0, raise: 0, call: 0, fold: 100 },
};

describe('actionFrequencies', () => {
  it('presentNodeActions: 存在するアクションのみ (fold→raise 順)', () => {
    expect(presentNodeActions(coOpen)).toEqual(['fold', 'raise']);
  });

  it('handActionFrequencies: 出題ハンドの頻度 (修正1)', () => {
    expect(handActionFrequencies(coOpen, '22')).toEqual([
      { action: 'fold', label: 'フォールド', pct: 44 },
      { action: 'raise', label: 'レイズ', pct: 56 },
    ]);
  });

  it('レンジ外ハンドは全 0% (不明点2)', () => {
    expect(handActionFrequencies(coOpen, 'KK')).toEqual([
      { action: 'fold', label: 'フォールド', pct: 0 },
      { action: 'raise', label: 'レイズ', pct: 0 },
    ]);
  });

  it('ラベル上書き (call → リンプ)', () => {
    const sbOpen: Record<string, FreqMap> = { AA: { raise: 50, call: 30, fold: 20 } };
    const rows = handActionFrequencies(sbOpen, 'AA', { call: 'リンプ' });
    expect(rows.find((r) => r.action === 'call')?.label).toBe('リンプ');
  });

  it('actionBarColor: 確定配色を再利用 (check は call と同色の緑)', () => {
    expect(actionBarColor('allin')).toBe('#534AB7');
    expect(actionBarColor('raise')).toBe('#D8443C');
    expect(actionBarColor('call')).toBe('#3B8A1E');
    expect(actionBarColor('fold')).toBe('#2F7BC4');
    expect(actionBarColor('check')).toBe('#3B8A1E');
  });

  it('barWidthPct: 頻度%に比例 (0..100 にクランプ)', () => {
    expect(barWidthPct(0)).toBe(0);
    expect(barWidthPct(12)).toBe(12);
    expect(barWidthPct(100)).toBe(100);
    expect(barWidthPct(120)).toBe(100);
    expect(barWidthPct(-5)).toBe(0);
  });

  it('修正3: 初級ノード (utg.json) はレンジデータを持つ (空でない)', () => {
    const node = JSON.parse(
      readFileSync(
        join(process.cwd(), 'public/data/preflop/cash_100bb_6max_nl500_2.5x/utg.json'),
        'utf8',
      ),
    ) as { hands: Record<string, FreqMap> };
    expect(Object.keys(node.hands).length).toBeGreaterThan(0);
    expect(presentNodeActions(node.hands).length).toBeGreaterThan(0);
    // AA は当然 raise 主体 (頻度>0)。
    const aa = handActionFrequencies(node.hands, 'AA');
    expect(aa.some((r) => r.pct > 0)).toBe(true);
  });
});
