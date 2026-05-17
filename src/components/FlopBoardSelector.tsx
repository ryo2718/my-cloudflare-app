// 「ボードを選択」アコーディオン (Flop タブ下部、Flopレポート Section の下に配置)。
//
// Phase 5 改修:
//   - サブメニューを pill → タブ式 (アクティブ下線) に変更
//   - 8 ボードを 4 列固定グリッドで表示
//   - 各ボードの 3 枚は共通 <PlayingCard size="md" /> + 3px gap (CardSet)
//   - 履歴/デフォルトは boardHistory.getTopBoards(8) から取得

import { useEffect, useState, type CSSProperties } from 'react';
import { THEME } from '../styles/theme';
import type { Rank, Suit } from '../types/card';
import { getTopBoards } from '../data/boardHistory';
import { CardSet } from './CardSet';

const SUB_MENU_ITEMS = [
  { key: 'select', label: 'ボードを選択', active: true },
  { key: 'analyze', label: '分析',       active: false },
  { key: 'rep',     label: '代表',       active: false },
  { key: 'all',     label: '全ボード',   active: false },
] as const;

export interface FlopBoardSelectorProps {
  /** ボタン押下時の callback (placeholder)。指定が無ければ console.log のみ。 */
  onSelectBoard?: (canonicalBoardName: string) => void;
}

export function FlopBoardSelector({ onSelectBoard }: FlopBoardSelectorProps) {
  const [expanded, setExpanded] = useState(false);
  const [topBoards, setTopBoards] = useState<string[]>(() => getTopBoards(8));
  const [highlight, setHighlight] = useState<string | null>(null);

  // 開いたタイミングで履歴を再取得 (FlopStrategyView で recordBoardSelection された後の更新を反映)
  useEffect(() => {
    if (expanded) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTopBoards(getTopBoards(8));
    }
  }, [expanded]);

  const handleSelect = (board: string) => {
    setHighlight(board);
    onSelectBoard?.(board);
    // 「ボードに適応」機能は別 Phase。現状は console placeholder。
    console.log('Board selected:', board);
  };

  return (
    <div style={containerStyle}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={headerStyle}
        aria-expanded={expanded}
      >
        <span style={chevronStyle} aria-hidden>
          {expanded ? '▲' : '▼'}
        </span>
        <span style={titleStyle}>ボードを選択</span>
      </button>

      {expanded && (
        <div style={bodyStyle}>
          {/* サブメニュー: タブ式 + アンダーライン */}
          <div style={tabRowStyle} role="tablist" aria-label="表示モード">
            {SUB_MENU_ITEMS.map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={item.active}
                aria-disabled={!item.active}
                disabled={!item.active}
                style={item.active ? tabActiveStyle : tabDisabledStyle}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* 8 ボードボタン: 4 列固定 grid */}
          <div style={boardGridStyle}>
            {topBoards.map((board) => (
              <BoardButton
                key={board}
                canonical={board}
                isHighlighted={highlight === board}
                onClick={() => handleSelect(board)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// BoardButton
// ----------------------------------------------------------------------------

function BoardButton({
  canonical,
  isHighlighted,
  onClick,
}: {
  canonical: string;
  isHighlighted: boolean;
  onClick: () => void;
}) {
  const cards = parseBoardCanonical(canonical);
  return (
    <button
      type="button"
      onClick={onClick}
      style={isHighlighted ? boardButtonActiveStyle : boardButtonStyle}
      aria-pressed={isHighlighted}
      title={canonical}
    >
      <CardSet cards={cards} size="md" gap={3} ariaLabel={canonical} />
    </button>
  );
}

function parseBoardCanonical(name: string): { rank: Rank; suit: Suit }[] {
  return [
    { rank: name[0] as Rank, suit: name[1] as Suit },
    { rank: name[2] as Rank, suit: name[3] as Suit },
    { rank: name[4] as Rank, suit: name[5] as Suit },
  ];
}

// ----------------------------------------------------------------------------
// Styles
// ----------------------------------------------------------------------------

const containerStyle: CSSProperties = {
  background: THEME.card,
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.5rem',
  overflow: 'hidden',
  marginTop: '0.75rem',
};

const headerStyle: CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.7rem 0.95rem',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: '0.92rem',
  color: THEME.textPrimary,
  textAlign: 'left',
};

const chevronStyle: CSSProperties = {
  fontSize: '0.78rem',
  color: THEME.textSecondary,
  minWidth: '14px',
};

const titleStyle: CSSProperties = {
  fontWeight: 700,
  letterSpacing: '0.04em',
};

const bodyStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.85rem',
  padding: '0.85rem 1rem 1.1rem',
  borderTop: `1px solid ${THEME.border}`,
};

// タブ式サブメニュー
const tabRowStyle: CSSProperties = {
  display: 'flex',
  gap: 0,
  borderBottom: `1px solid ${THEME.border}`,
  paddingBottom: 0,
};

const tabBaseStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  borderBottom: '2px solid transparent',
  padding: '0.45rem 1rem',
  fontSize: '0.82rem',
  fontFamily: 'inherit',
  marginBottom: -1,
};

const tabActiveStyle: CSSProperties = {
  ...tabBaseStyle,
  color: THEME.accent,
  borderBottomColor: THEME.accent,
  fontWeight: 600,
  cursor: 'pointer',
};

const tabDisabledStyle: CSSProperties = {
  ...tabBaseStyle,
  color: THEME.textFaint,
  opacity: 0.5,
  cursor: 'not-allowed',
};

// 4 列固定 grid
const boardGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: '0.55rem',
};

const boardButtonBase: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '8px',
  background: '#ffffff',
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.4rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'background 0.1s, border-color 0.1s',
};

const boardButtonStyle: CSSProperties = boardButtonBase;

const boardButtonActiveStyle: CSSProperties = {
  ...boardButtonBase,
  background: '#FDE6C8',
  borderColor: '#D97706',
};
