// @vitest-environment jsdom
// 役フィルターの吹き出し式 内訳UI + コンボ数/% 表示のテスト。
//   - 役を選択すると青 (ACTION_COLOR.fold) で表示される
//   - 内訳の吹き出しは「指している1役分」のみ表示される
//   - 役チップのタップで内訳の向き先 (中身) が切り替わる
//   - 組み合わせ行のプルダウンが開閉し、スート単位が表示される
//   - 役ボタン・内訳行に「%(コンボ数)」が表示される (% の分母 = 現在レンジの総コンボ数 range.size)
// 絞り込みロジック (analyzeBoard/applyFilter) は handFilter.test.ts で別途検証済み。

import { describe, it, expect, vi } from 'vitest';
import { render, screen, userEvent } from '../../test/ui';
import { stringToCard } from '../../types/card';
import { comboKeyOf } from '../../utils/combos';
import { HandFilter } from './HandFilter';

const card = (s: string) => stringToCard(s)!;
const k = (a: string, b: string) => comboKeyOf(card(a), card(b));

// ボード Kd Jd 2d Jh 4s (JJ ペア + ダイヤ3枚)。
const BOARD = ['Kd', 'Jd', '2d', 'Jh', '4s'].map(card);
// AdQd=フラッシュ / AsAc=ツーペア(AA+JJ) / AhQh・Th9c=ワンペア(JJ) / AdKd=ボード衝突(Kd)で集計外。
// → 成立役は フラッシュ1 / ツーペア1 / ワンペア2。range.size=5 (衝突コンボ込み) が % の分母。
const RANGE = new Map<string, number>([
  [k('Ad', 'Qd'), 1],
  [k('As', 'Ac'), 1],
  [k('Ah', 'Qh'), 1],
  [k('Th', '9c'), 1],
  [k('Ad', 'Kd'), 1],
]);

const renderFilter = () => render(<HandFilter board={BOARD} range={RANGE} onApply={vi.fn()} />);

describe('HandFilter (吹き出し式 内訳UI + %/コンボ数)', () => {
  it('役を選択すると青 (ACTION_COLOR.fold) で表示される', async () => {
    const user = userEvent.setup();
    renderFilter();
    const tp = screen.getByRole('button', { name: /^ツーペア/ });
    expect(tp.getAttribute('aria-pressed')).toBe('false');

    await user.click(tp);

    expect(tp.getAttribute('aria-pressed')).toBe('true');
    // 選択中は青 (#2F7BC4 / rgb(47,123,196))。hex でも rgb でも許容。
    const style = tp.getAttribute('style') ?? '';
    expect(/2f7bc4|47,\s*123,\s*196/i.test(style)).toBe(true);
  });

  it('内訳の吹き出しは「指している1役分」のみ表示される', async () => {
    const user = userEvent.setup();
    renderFilter();
    expect(screen.queryByText(/の内訳$/)).toBeNull();

    await user.click(screen.getByRole('button', { name: /^フラッシュ/ }));
    await user.click(screen.getByRole('button', { name: /^ツーペア/ }));

    // 吹き出しは最後に選択した ツーペア を指す。内訳枠は1つだけ。
    expect(screen.getByText('ツーペア の内訳')).toBeTruthy();
    expect(screen.queryByText('フラッシュ の内訳')).toBeNull();
    expect(screen.getAllByText(/の内訳$/).length).toBe(1);
    expect(screen.getByText('AA + JJ')).toBeTruthy();
  });

  it('役チップのタップで内訳の中身が切り替わる', async () => {
    const user = userEvent.setup();
    renderFilter();
    await user.click(screen.getByRole('button', { name: /^フラッシュ/ }));
    await user.click(screen.getByRole('button', { name: /^ツーペア/ }));
    expect(screen.getByText('ツーペア の内訳')).toBeTruthy();

    // 選択中の フラッシュ をタップ → 内訳が フラッシュ に切り替わる (選択は解除されない)。
    await user.click(screen.getByRole('button', { name: /^フラッシュ/ }));
    expect(screen.getByText('フラッシュ の内訳')).toBeTruthy();
    expect(screen.queryByText('ツーペア の内訳')).toBeNull();
    expect(screen.getByRole('button', { name: /^フラッシュ/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /^ツーペア/ }).getAttribute('aria-pressed')).toBe('true');
  });

  it('組み合わせ行のプルダウンが開閉し、スート単位が表示される', async () => {
    const user = userEvent.setup();
    renderFilter();
    await user.click(screen.getByRole('button', { name: /^ワンペア/ }));
    expect(screen.getByText('JJ')).toBeTruthy();

    const chevron = screen.getByRole('button', { name: '内訳の開閉' });
    expect(chevron.getAttribute('aria-expanded')).toBe('false');
    const before = screen.getAllByRole('checkbox').length;

    await user.click(chevron);
    expect(chevron.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(before);

    await user.click(chevron);
    expect(chevron.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getAllByRole('checkbox').length).toBe(before);
  });

  it('役ボタンに「%(コンボ数)」を表示する (% = 役コンボ数 / 現在レンジ総数 range.size)', () => {
    renderFilter();
    // range.size=5 が分母。フラッシュ1/5=20%, ツーペア1/5=20%, ワンペア2/5=40%。
    expect(screen.getByRole('button', { name: /^フラッシュ 20%\(1\)$/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^ツーペア 20%\(1\)$/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^ワンペア 40%\(2\)$/ })).toBeTruthy();
  });

  it('内訳の各行に「%(コンボ数)」を表示する', async () => {
    const user = userEvent.setup();
    renderFilter();
    await user.click(screen.getByRole('button', { name: /^ワンペア/ }));
    // ワンペアの内訳 JJ は 2 コンボ → 2/5 = 40%。
    expect(screen.getByText('JJ')).toBeTruthy();
    expect(screen.getByText('40%(2)')).toBeTruthy();
  });
});
