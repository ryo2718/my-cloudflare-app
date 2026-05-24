// @vitest-environment jsdom
// 結果レビュー展開部 (案B): 積み上げ帯 + 「打つ/打たない」2択枠 + あなた/正解バッジ。

import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, screen, within } from '../../test/ui';
import { FlopReviewDetail } from './FlopReviewDetail';
import { ACTION_COLOR } from '../../styles/actionColors';
import type { FlopRecord } from '../../data/training/flopBeginner';

function makeRec(over: Partial<FlopRecord>): FlopRecord {
  return {
    id: 1,
    recordId: 1,
    type: 'cb',
    pot: 'SRP',
    variant: 'btnr_bbc',
    hero: 'BTN',
    villain: 'BB',
    board: [{ rank: 'A', suit: 's' }, { rank: 'K', suit: 'd' }, { rank: '2', suit: 'c' }],
    rate: 0.3,
    threshold: 0.7,
    correct: 'check',
    actions: [
      { code: 'X', freq: 0.7, bp: 0 },
      { code: 'R2', freq: 0.2, bp: 0.33 },
      { code: 'R5', freq: 0.1, bp: 0.75 },
    ],
    preflopActions: [],
    choice: 'bet',
    isCorrect: false,
    ...over,
  };
}

const frameOf = (label: RegExp) => screen.getByText(label).closest('div') as HTMLElement;

describe('FlopReviewDetail', () => {
  it('積み上げ帯にベット(赤系)とチェック(緑)のセグメントが出る', () => {
    const html = renderToStaticMarkup(<FlopReviewDetail record={makeRec({})} />);
    expect(html).toContain('hsl(2,'); // ベット赤系グラデ (barColor)
    expect(html).toContain(ACTION_COLOR.check); // チェック緑
  });

  it('ベットサイズ別の頻度% を帯下に併記 (混合戦略を失わない)', () => {
    render(<FlopReviewDetail record={makeRec({})} />);
    expect(screen.getByText(/ベット 33% 20%/)).toBeTruthy(); // R2: サイズ33% / 頻度20%
    expect(screen.getByText(/ベット 75% 10%/)).toBeTruthy(); // R5: サイズ75% / 頻度10%
    expect(screen.getByText(/チェック 70%/)).toBeTruthy();
  });

  it('2択枠が頻度比の幅 (flexGrow) で出る', () => {
    render(<FlopReviewDetail record={makeRec({})} />);
    const bet = frameOf(/CB打つ/);
    const chk = frameOf(/CB打たない/);
    expect(parseFloat(bet.style.flexGrow)).toBeCloseTo(0.3); // 打つ = betTotal 0.3
    expect(parseFloat(chk.style.flexGrow)).toBeCloseTo(0.7); // 打たない = check 0.7
    expect(screen.getByText(/CB打つ 30%/)).toBeTruthy();
    expect(screen.getByText(/CB打たない 70%/)).toBeTruthy();
  });

  it('不正解時: 選んだ枠に「あなた」(青)、正解枠に「正解」(赤) が別々に付く', () => {
    render(<FlopReviewDetail record={makeRec({ choice: 'bet', correct: 'check' })} />);
    const bet = frameOf(/CB打つ/);
    const chk = frameOf(/CB打たない/);
    expect(within(bet).getByText('あなた')).toBeTruthy();
    expect(within(bet).queryByText('正解')).toBeNull();
    expect(within(chk).getByText('正解')).toBeTruthy();
    expect(within(chk).queryByText('あなた')).toBeNull();
  });

  it('正解時: 同じ枠に「あなた」「正解」の両方が付く', () => {
    render(<FlopReviewDetail record={makeRec({ choice: 'check', correct: 'check', isCorrect: true })} />);
    const chk = frameOf(/CB打たない/);
    const bet = frameOf(/CB打つ/);
    expect(within(chk).getByText('あなた')).toBeTruthy();
    expect(within(chk).getByText('正解')).toBeTruthy();
    expect(within(bet).queryByText('あなた')).toBeNull();
    expect(within(bet).queryByText('正解')).toBeNull();
  });

  it('ドンク問題は「ドンク打つ/ドンク打たない」表記', () => {
    render(<FlopReviewDetail record={makeRec({ type: 'donk' })} />);
    expect(screen.getByText(/ドンク打つ/)).toBeTruthy();
    expect(screen.getByText(/ドンク打たない/)).toBeTruthy();
  });
});
