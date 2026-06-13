// @vitest-environment jsdom
// ポストフロップ (レンジCB / レンジドンク・BMCB) のルール説明が、
// 「ボード依存性」を伝える 2 ボード比較ビュー (AK3 / AA3 の BTN CB 戦略を頻度バーで対比)
// を表示することを確認する。13×13 ヒートマップは廃止済み。

import { describe, it, expect } from 'vitest';
import { render, screen } from '../../test/ui';
import { RuleExplanation } from './RuleExplanation';

describe('RuleExplanation ポストフロップ (ボード比較ビュー)', () => {
  it.each(['srp_non_blind', '3bp_4bp_5bp_blind', 'donk_bmcb'])(
    '%s でタイトル・概念説明・2ボード・固定値の頻度バーを表示する',
    (levelKey) => {
      const { container } = render(<RuleExplanation levelKey={levelKey} />);

      // タイトル + 概念説明。
      expect(screen.getByText('ボードによって戦略はガラッと変わる')).toBeTruthy();
      expect(screen.getByText(/ボードに対して、レンジ全体としてどう打つか/)).toBeTruthy();

      // 2 つのボードセクション + タグライン。
      expect(screen.getByText('ボードA(AK3)')).toBeTruthy();
      expect(screen.getByText('ボードB(AA3)')).toBeTruthy();
      expect(screen.getByText('分極(打たない or 大きく打つ)')).toBeTruthy();
      expect(screen.getByText('レンジ全体で安く連打')).toBeTruthy();

      // 固定値の頻度バー (一意な値で検証): AK3 check 61% / AA3 bet33 82% / AA3 check 14%。
      expect(screen.getByText('61%')).toBeTruthy();
      expect(screen.getByText('82%')).toBeTruthy();
      expect(screen.getByText('14%')).toBeTruthy();

      // 旧 13×13 ヒートマップ (role="grid") は廃止済み。
      expect(container.querySelector('[role="grid"]')).toBeNull();
    },
  );

  it('プリフロップ levelKey ではポストフロップ説明を出さない', () => {
    render(<RuleExplanation levelKey="preflop_beginner" />);
    expect(screen.queryByText('ボードによって戦略はガラッと変わる')).toBeNull();
  });
});
