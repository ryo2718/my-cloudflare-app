// 役フィルター (レンジ構築補助)。ボードが3枚以上のとき、ボード+現在レンジから
// 成立する役を逆引きし、選んだ役のコンボだけにレンジを「置き換える」。
//   - ボードカード表示 (PlayingCard 再利用) / 役名チップ行 / 内訳パネル / 適用ボタン
//   - チップ=役のオン/オフ。内訳はデフォルト全オン、個別に外せる (部分選択可)
//   - 適用 = 現在レンジ ∩ (オン役 ∩ オン内訳) のコンボ和集合 (置き換え)
// エクイティ計算には関与しない。

import { useMemo, useState, type CSSProperties } from 'react';
import { PlayingCard } from '../PlayingCard';
import { THEME } from '../../styles/theme';
import { cardToInt } from '../../utils/handEvaluator';
import { cardToString, type Card } from '../../types/card';
import { ROLE_LABEL, analyzeBoard, applyFilter, type RoleKey } from '../../utils/handFilter';

const CHIP_ON_BG = '#EAF3DE';
const CHIP_ON_BORDER = '#639922';
const CHIP_ON_TEXT = '#27500A';

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

  // オンにした役 (オン順)。最後尾が「直近にオンにした役」。
  const [onRoles, setOnRoles] = useState<RoleKey[]>([]);
  // オフにした内訳の leaf key 集合 (デフォルトは全オン)。
  const [offItems, setOffItems] = useState<Set<string>>(new Set());

  const removePrefix = (set: Set<string>, prefix: string) => {
    const next = new Set(set);
    for (const k of next) if (k.startsWith(prefix)) next.delete(k);
    return next;
  };

  const toggleRole = (rk: RoleKey) => {
    setOffItems((prev) => removePrefix(prev, `${rk}|`)); // 再オンは全オンで開く
    setOnRoles((prev) => (prev.includes(rk) ? prev.filter((r) => r !== rk) : [...prev, rk]));
  };

  const toggleLeaf = (leafKey: string) => {
    setOffItems((prev) => {
      const next = new Set(prev);
      if (next.has(leafKey)) next.delete(leafKey);
      else next.add(leafKey);
      return next;
    });
  };

  const lastOn = onRoles.length > 0 ? onRoles[onRoles.length - 1] : null;
  const panelGroup = lastOn ? groups.find((g) => g.key === lastOn) ?? null : null;

  const collectKeys = (): Set<string> => {
    const keys = new Set<string>();
    for (const rk of onRoles) {
      const g = groups.find((gr) => gr.key === rk);
      if (!g) continue;
      for (const item of g.items) {
        if (offItems.has(`${rk}|${item.key}`)) continue;
        if (item.children) {
          for (const ch of item.children) {
            if (offItems.has(`${rk}|${item.key}|${ch.key}`)) continue;
            for (const c of ch.combos) keys.add(c);
          }
        } else {
          for (const c of item.combos) keys.add(c);
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
          return (
            <button
              key={g.key}
              type="button"
              aria-pressed={on}
              onClick={() => toggleRole(g.key)}
              style={on ? chipOnStyle : chipOffStyle}
            >
              {g.label}
            </button>
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
              return (
                <div key={item.key} style={itemBlockStyle}>
                  <label style={itemRowStyle}>
                    <input type="checkbox" checked={itemOn} onChange={() => toggleLeaf(itemLeaf)} />
                    {item.label}
                  </label>
                  {item.children && itemOn && (
                    <div style={childrenStyle}>
                      {item.children.map((ch) => {
                        const childLeaf = `${panelGroup.key}|${item.key}|${ch.key}`;
                        return (
                          <label key={ch.key} style={childRowStyle}>
                            <input
                              type="checkbox"
                              checked={!offItems.has(childLeaf)}
                              onChange={() => toggleLeaf(childLeaf)}
                            />
                            {ch.label}
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
const chipsStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: '0.35rem' };
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
  background: CHIP_ON_BG,
  color: CHIP_ON_TEXT,
  border: `1px solid ${CHIP_ON_BORDER}`,
  fontWeight: 700,
};
const panelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
  background: '#fff',
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.4rem',
  padding: '0.5rem',
};
const panelHeaderStyle: CSSProperties = { fontSize: '0.85rem', fontWeight: 700, color: THEME.textPrimary };
const panelBodyStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.2rem',
  maxHeight: 180,
  overflowY: 'auto',
};
const itemBlockStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.15rem' };
const itemRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.4rem',
  fontSize: '0.82rem',
  color: THEME.textPrimary,
  cursor: 'pointer',
};
const childrenStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.1rem 0.8rem',
  paddingLeft: '1.2rem',
};
const childRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.3rem',
  fontSize: '0.78rem',
  color: THEME.textSecondary,
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
