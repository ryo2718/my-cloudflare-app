// @vitest-environment jsdom
// ポストフロップ (レンジCB / レンジドンク・BMCB) のルール説明が、
// 「ボードに対してレンジ全体でどう打つか」のテキストと 6色グラデーションの
// ミニチュアレンジビュー (13×13 グリッド + 凡例) を表示することを確認する。

import { describe, it, expect } from 'vitest';
import { render, screen } from '../../test/ui';
import { RuleExplanation } from './RuleExplanation';

describe('RuleExplanation ポストフロップ', () => {
  it.each(['flop_cb_srp', 'flop_cb_3bp', 'flop_donk_bmcb'])(
    '%s でレンジ全体の説明とミニチュアレンジビューを表示する',
    (levelKey) => {
      const { container } = render(<RuleExplanation levelKey={levelKey} />);
      // 概念説明の見出し。
      expect(screen.getByText('ポストフロップの考え方')).toBeTruthy();
      // 13×13 グリッド (HandGrid, role="grid") = 169 セル。
      const grid = container.querySelector('[role="grid"]');
      expect(grid).toBeTruthy();
      expect(grid!.childElementCount).toBe(169);
      // 6色ランプの凡例 (チェック / オールイン)。
      expect(screen.getByText('チェック')).toBeTruthy();
      expect(screen.getByText('オールイン')).toBeTruthy();
    },
  );

  it('プリフロップ levelKey ではポストフロップ説明を出さない', () => {
    render(<RuleExplanation levelKey="preflop_beginner" />);
    expect(screen.queryByText('ポストフロップの考え方')).toBeNull();
  });
});
