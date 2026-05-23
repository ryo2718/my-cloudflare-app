// 役フィルター (レンジ構築補助)。ボードが3枚以上のとき、ボード+現在レンジから
// 成立する役を逆引きし、選んだ役のコンボだけにレンジを「置き換える」。
//   - ボードカード表示 (PlayingCard 再利用) / 役名チップ行 / 内訳の吹き出し / 適用ボタン
//   - チップ=役の選択 (複数可)。選択中は青 (ACTION_COLOR.fold を流用)。
//   - 内訳は「吹き出し」式: 1役分のみ表示し、指す先のチップ真下から tail が出る。
//     タップで選択+内訳表示 / 別の選択中役タップで内訳切替 / 表示中の役を再タップで選択解除。
//   - 内訳行はプルダウン (デフォルト畳む)。チェック=その組み合わせの選択、開くとスート単位を表示。
//   - 適用 = 現在レンジ ∩ (オン役 ∩ オン内訳) のコンボ和集合 (置き換え)
// エクイティ計算には関与しない。

import { useMemo, useState, type CSSProperties } from 'react';
import { PlayingCard } from '../PlayingCard';
import { THEME } from '../../styles/theme';
import { ACTION_COLOR } from '../../styles/actionColors';
import { cardToInt } from '../../utils/handEvaluator';
import { cardToString, type Card } from '../../types/card';
import { ROLE_LABEL, analyzeBoard, applyFilter, type BreakdownItem, type RoleKey } from '../../utils/handFilter';
import { ComboCards } from './ComboCards';

// 選択中役の「青」は既存の青トークン (ACTION_COLOR.fold) を流用 (新規の色は定義しない)。
// 吹き出しの地は同トークンを薄めた色 (色は同トークンを参照)。
const SEL_BLUE = ACTION_COLOR.fold;
const SEL_BLUE_BG = `color-mix(in srgb, ${SEL_BLUE} 10%, #fff)`;

export interface HandFilterProps {
  /** 現在のボード (3〜5枚)。3枚未満なら呼び出し側で非表示にする想定。 */
  board: ReadonlyArray<Card>;
  /** 現在のレンジ (コンボ key → weight)。 */
  range: ReadonlyMap<string, number>;
  /** 相手の確定ハンド (2枚)。これらを含むコンボは役候補から除外。レンジ/未設定なら空。 */
  excludeCards?: ReadonlyArray<Card>;
  /** 適用時に新しいレンジを渡す。 */
  onApply: (range: Map<string, number>) => void;
}

export function HandFilter({ board, range, excludeCards, onApply }: HandFilterProps) {
  const boardKey = board.map(cardToString).join('');
  const excludeKey = (excludeCards ?? []).map(cardToString).join('');
  const groups = useMemo(
    () => analyzeBoard(range, board.map(cardToInt), new Set((excludeCards ?? []).map(cardToInt))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [range, boardKey, excludeKey],
  );

  // 選択中の役 (選択順)。最後尾が「直近に選択した役」。
  const [onRoles, setOnRoles] = useState<RoleKey[]>([]);
  // 吹き出しが指す役 (内訳を表示している役)。選択中の役のみ対象。
  const [focused, setFocused] = useState<RoleKey | null>(null);
  // オフにした内訳の leaf key 集合 (デフォルトは全オン)。チェック状態。
  const [offItems, setOffItems] = useState<Set<string>>(new Set());
  // 開いている内訳の leaf key 集合 (デフォルトは畳む)。チェックとは独立。
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const removePrefix = (set: Set<string>, prefix: string) => {
    const next = new Set(set);
    for (const k of next) if (k.startsWith(prefix)) next.delete(k);
    return next;
  };

  // 役チップのタップ:
  //   未選択      → 選択し、その役に内訳を向ける (全オン・全畳みで開く)
  //   選択中の別役 → 内訳の向き先だけ切替 (選択状態は維持)
  //   内訳表示中  → 選択解除 (向き先は残りの直近選択役へ)
  const onRoleTap = (rk: RoleKey) => {
    if (!onRoles.includes(rk)) {
      setOffItems((prev) => removePrefix(prev, `${rk}|`));
      setExpanded((prev) => removePrefix(prev, `${rk}|`));
      setOnRoles((prev) => [...prev, rk]);
      setFocused(rk);
      return;
    }
    if (focused !== rk) {
      setFocused(rk);
      return;
    }
    const remaining = onRoles.filter((r) => r !== rk);
    setOffItems((prev) => removePrefix(prev, `${rk}|`));
    setExpanded((prev) => removePrefix(prev, `${rk}|`));
    setOnRoles(remaining);
    setFocused(remaining.length > 0 ? remaining[remaining.length - 1] : null);
  };

  const toggleLeaf = (leafKey: string) => {
    setOffItems((prev) => {
      const next = new Set(prev);
      if (next.has(leafKey)) next.delete(leafKey);
      else next.add(leafKey);
      return next;
    });
  };

  // プルダウンの開閉 (チェック状態・適用対象は変えない)。
  const toggleExpand = (itemLeaf: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(itemLeaf)) next.delete(itemLeaf);
      else next.add(itemLeaf);
      return next;
    });
  };

  const panelGroup = focused ? groups.find((g) => g.key === focused) ?? null : null;

  // item 配下の具体コンボ key (フラッシュ等は children、それ以外は combos)。
  const comboKeysOf = (item: BreakdownItem): string[] =>
    item.children ? item.children.map((c) => c.key) : item.combos;

  // % の分母 = 現在適用されているレンジの総コンボ数 (range.size)。役を「適用」すると
  // レンジがその役のコンボに置き換わるため、分母も自動で追従する。
  const total = range.size;
  const pctOf = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  const collectKeys = (): Set<string> => {
    const keys = new Set<string>();
    for (const rk of onRoles) {
      const g = groups.find((gr) => gr.key === rk);
      if (!g) continue;
      for (const item of g.items) {
        if (offItems.has(`${rk}|${item.key}`)) continue;
        for (const ck of comboKeysOf(item)) {
          if (offItems.has(`${rk}|${item.key}|${ck}`)) continue;
          keys.add(ck);
        }
      }
    }
    return keys;
  };

  const apply = () => {
    if (onRoles.length === 0) return;
    onApply(applyFilter(range, collectKeys()));
  };

  return (
    <div style={wrapStyle}>
      <div style={boardRowStyle}>
        {board.map((c, i) => (
          <PlayingCard key={i} rank={c.rank} suit={c.suit} size="board" />
        ))}
      </div>

      <div style={chipsStyle}>
        {groups.map((g) => {
          const on = onRoles.includes(g.key);
          const isFocused = focused === g.key;
          const count = g.combos.length;
          return (
            <div key={g.key} style={chipCellStyle}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onRoleTap(g.key)}
                style={on ? chipOnStyle : chipOffStyle}
              >
                {g.label} {pctOf(count)}%({count})
              </button>
              {isFocused && <div style={tailStyle} aria-hidden="true" />}
            </div>
          );
        })}
      </div>

      {panelGroup && (
        <div style={panelStyle}>
          <span style={panelHeaderStyle}>{ROLE_LABEL[panelGroup.key]} の内訳</span>
          <div style={panelBodyStyle}>
            {panelGroup.items.map((item) => {
              const itemLeaf = `${panelGroup.key}|${item.key}`;
              const itemOn = !offItems.has(itemLeaf);
              const open = expanded.has(itemLeaf);
              const itemCount = comboKeysOf(item).length;
              return (
                <div key={item.key} style={itemBlockStyle}>
                  <div style={itemRowStyle}>
                    <label style={itemCheckStyle}>
                      <input type="checkbox" checked={itemOn} onChange={() => toggleLeaf(itemLeaf)} />
                      {item.label}
                    </label>
                    <span style={countStyle}>{pctOf(itemCount)}%({itemCount})</span>
                    <button
                      type="button"
                      onClick={() => toggleExpand(itemLeaf)}
                      aria-expanded={open}
                      aria-label="内訳の開閉"
                      style={chevronStyle}
                    >
                      {open ? '▾' : '▸'}
                    </button>
                  </div>
                  {itemOn && open && (
                    <div style={combosWrapStyle}>
                      {comboKeysOf(item).map((ck) => {
                        const comboLeaf = `${panelGroup.key}|${item.key}|${ck}`;
                        return (
                          <label key={ck} style={comboChipStyle}>
                            <input
                              type="checkbox"
                              checked={!offItems.has(comboLeaf)}
                              onChange={() => toggleLeaf(comboLeaf)}
                            />
                            <ComboCards comboKey={ck} />
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <button type="button" onClick={apply} disabled={onRoles.length === 0} style={onRoles.length === 0 ? applyDisabledStyle : applyStyle}>
        適用
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const wrapStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  padding: '0.6rem',
  background: THEME.cardElevated,
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.5rem',
  marginBottom: '0.6rem',
};
const boardRowStyle: CSSProperties = { display: 'flex', gap: '0.3rem', justifyContent: 'flex-end' };
// チップは横一列 (折り返し可)。tail がチップ真下に出るので上揃え。
const chipsStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '0.35rem' };
const chipCellStyle: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center' };
const chipBaseStyle: CSSProperties = {
  padding: '0.3rem 0.6rem',
  borderRadius: '0.4rem',
  fontSize: '0.82rem',
  fontFamily: 'inherit',
  cursor: 'pointer',
};
const chipOffStyle: CSSProperties = {
  ...chipBaseStyle,
  background: '#fff',
  color: THEME.textSecondary,
  border: `1px solid ${THEME.border}`,
};
const chipOnStyle: CSSProperties = {
  ...chipBaseStyle,
  background: SEL_BLUE,
  color: '#fff',
  border: `1px solid ${SEL_BLUE}`,
  fontWeight: 700,
};
// 吹き出しの tail (チップ真下の下向き三角、内訳枠と同じ青)。
const tailStyle: CSSProperties = {
  width: 0,
  height: 0,
  borderLeft: '6px solid transparent',
  borderRight: '6px solid transparent',
  borderTop: `7px solid ${SEL_BLUE}`,
  marginTop: 2,
};
const panelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
  background: SEL_BLUE_BG,
  border: `1px solid ${SEL_BLUE}`,
  borderRadius: '0.4rem',
  padding: '0.5rem',
};
const panelHeaderStyle: CSSProperties = { fontSize: '0.85rem', fontWeight: 700, color: SEL_BLUE };
const panelBodyStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.2rem',
  maxHeight: 180,
  overflowY: 'auto',
};
const itemBlockStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.15rem' };
const itemRowStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.3rem' };
const chevronStyle: CSSProperties = {
  width: 20,
  height: 20,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 'none',
  color: THEME.textSecondary,
  fontSize: '0.7rem',
  cursor: 'pointer',
  padding: 0,
  fontFamily: 'inherit',
};
const itemCheckStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.4rem',
  flex: '1 1 0',
  minWidth: 0,
  fontSize: '0.82rem',
  fontWeight: 700,
  color: THEME.textPrimary,
  cursor: 'pointer',
};
const countStyle: CSSProperties = {
  fontSize: '0.75rem',
  color: THEME.textSecondary,
  fontVariantNumeric: 'tabular-nums',
};
// 中間見出し配下の具体コンボ (カードビジュアル) を flex-wrap で折り返し。
const combosWrapStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.2rem 0.6rem',
  paddingLeft: '1.2rem',
};
const comboChipStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.25rem',
  fontSize: '0.82rem',
  cursor: 'pointer',
};
const applyStyle: CSSProperties = {
  alignSelf: 'flex-start',
  padding: '0.4rem 1rem',
  background: THEME.accent,
  color: '#fff',
  border: `1px solid ${THEME.accent}`,
  borderRadius: '0.4rem',
  fontSize: '0.85rem',
  fontWeight: 700,
  fontFamily: 'inherit',
  cursor: 'pointer',
};
const applyDisabledStyle: CSSProperties = {
  ...applyStyle,
  background: THEME.cellEmpty,
  color: THEME.textMuted,
  border: `1px solid ${THEME.border}`,
  cursor: 'not-allowed',
};
