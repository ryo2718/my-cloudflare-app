// @vitest-environment jsdom
// ポストフロップ初級 (flop_beginner) のルール説明: 概念 + CB2例 + ドンク2例 + 採点 + 用語、
// および二値バー (打つ/打たない) の比率表示を確認する。

import { describe, it, expect } from 'vitest';
import { render, screen } from '../../test/ui';
import { RuleExplanation } from './RuleExplanation';

describe('RuleExplanation ポストフロップ初級 (flop_beginner)', () => {
  it('概念・CB2例・ドンク2例・採点・用語 の構造で描画される', () => {
    render(<RuleExplanation levelKey="flop_beginner" />);
    // 概念。
    expect(screen.getByText('フロップは“自分の手”でなく“ボード × レンジ”で打つか決める')).toBeTruthy();
    // CB 2 例。
    expect(screen.getByText('打ちやすいボード(例:A K 3)')).toBeTruthy();
    expect(screen.getByText('打ちにくいボード(例:7 6 5)')).toBeTruthy();
    // ドンク 2 例 (打つ / 打たない の対)。
    expect(screen.getByText('ドンクするボード(例:8 7 6)')).toBeTruthy();
    expect(screen.getByText('ドンクしないボード(例:A J T)')).toBeTruthy();
    // タグライン。
    expect(screen.getByText('ほぼ全部CB')).toBeTruthy();
    expect(screen.getByText('ほとんど打たない')).toBeTruthy();
    expect(screen.getByText('よくドンク')).toBeTruthy();
    expect(screen.getByText('絶対チェック')).toBeTruthy();
    // 採点 + 用語。
    expect(screen.getByText('採点ルール')).toBeTruthy();
    expect(screen.getByText('用語')).toBeTruthy();
    expect(screen.getByText(/CB\(コンティニュエーションベット\)/)).toBeTruthy();
  });

  it('二値バーが各ボード例で正しい比率 (90/10・25/75・90/10・0/100) を表示', () => {
    render(<RuleExplanation levelKey="flop_beginner" />);
    expect(screen.getByText('CB打つ 90%')).toBeTruthy();
    expect(screen.getByText('打たない 75%')).toBeTruthy();
    expect(screen.getByText('CB打つ 25%')).toBeTruthy();
    expect(screen.getByText('ドンク打つ 90%')).toBeTruthy();
    expect(screen.getByText('ドンク打つ 0%')).toBeTruthy();
    expect(screen.getByText('打たない 100%')).toBeTruthy();
    // 「打たない 10%」は CB打ちやすい・ドンクするの 2 箇所に出る。
    expect(screen.getAllByText('打たない 10%').length).toBe(2);
  });

  it('中級ボード比較 (ボードA/B) の文言は初級では出さない', () => {
    render(<RuleExplanation levelKey="flop_beginner" />);
    expect(screen.queryByText('ボードによって戦略はガラッと変わる')).toBeNull();
  });

  it('回帰: 中級 srp_non_blind は従来どおりボード比較を表示', () => {
    render(<RuleExplanation levelKey="srp_non_blind" />);
    expect(screen.getByText('ボードによって戦略はガラッと変わる')).toBeTruthy();
    expect(screen.getByText('ボードA(AK3)')).toBeTruthy();
  });
});
