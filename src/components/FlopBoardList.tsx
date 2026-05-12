// 1,755 boards の折りたたみリスト (デフォルト閉じ)。
// 各行: ♠♥♦♣ 色付き board + 主要 action 2 個 (頻度上位)。
// クリックで親に board name を通知。
//
// レンダリング戦略: 素朴 div で 1,755 行を全部描画 (Q2 = react-window 案 B 確定)。
// 折りたたみデフォルトで初期コスト 0、開いた時のみ描画。Phase 4.3 完了時に実測して
// 遅ければ react-window 換装。

import { useMemo, type CSSProperties } from 'react';
import type { ActionSolution, BoardSolution } from '../types/flop';
import { parseBoardName } from '../utils/flopBoardCanonical';
import { SUIT_COLOR, SUIT_SYMBOL } from '../types/card';
import { THEME } from '../styles/theme';

interface Props {
  solutions: ReadonlyArray<BoardSolution>;
  selectedBoard: string | null;
  onBoardSelect: (name: string) => void;
}

export function FlopBoardList({ solutions, selectedBoard, onBoardSelect }: Props) {
  return (
    <details style={detailsStyle}>
      <summary style={summaryStyle}>
        Board 別解 ({solutions.length})
        {selectedBoard && (
          <span style={selectedHintStyle}> · 選択中: {selectedBoard}</span>
        )}
      </summary>
      <div style={listStyle}>
        {solutions.map((sol) => (
          <BoardRow
            key={sol.name}
            solution={sol}
            selected={sol.name === selectedBoard}
            onClick={() => onBoardSelect(sol.name)}
          />
        ))}
      </div>
    </details>
  );
}

// ----------------------------------------------------------------------------
// Row
// ----------------------------------------------------------------------------

function BoardRow({
  solution,
  selected,
  onClick,
}: {
  solution: BoardSolution;
  selected: boolean;
  onClick: () => void;
}) {
  const top2 = useMemo(() => topActions(solution.action_solutions, 2), [
    solution.action_solutions,
  ]);
  const cards = useMemo(() => parseBoardName(solution.name), [solution.name]);

  return (
    <button
      type="button"
      onClick={onClick}
      style={selected ? rowSelectedStyle : rowStyle}
    >
      <span style={boardLabelStyle}>
        {cards.map((c, i) => (
          <span key={i} style={{ color: SUIT_COLOR[c.suit] }}>
            {c.rank}
            {SUIT_SYMBOL[c.suit]}
          </span>
        ))}
      </span>
      <span style={actionsStyle}>{top2.map(formatAction).join(' · ')}</span>
    </button>
  );
}

function topActions(
  solutions: ReadonlyArray<ActionSolution>,
  n: number,
): ActionSolution[] {
  return [...solutions]
    .filter((s) => s.frequency > 0)
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, n);
}

function formatAction(a: ActionSolution): string {
  const pct = Math.round(a.frequency * 100);
  const code = a.action_code;
  if (code === 'X') return `X ${pct}%`;
  if (code === 'C') return `C ${pct}%`;
  if (code === 'F') return `F ${pct}%`;
  if (code === 'RAI') return `AI ${pct}%`;
  return `${code} ${pct}%`;
}

// ----------------------------------------------------------------------------
// Styles
// ----------------------------------------------------------------------------

const detailsStyle: CSSProperties = {
  background: THEME.card,
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.5rem',
  padding: '0.6rem 0.8rem',
};

const summaryStyle: CSSProperties = {
  cursor: 'pointer',
  fontSize: '0.78rem',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: THEME.textSecondary,
  fontWeight: 700,
  userSelect: 'none',
};

const selectedHintStyle: CSSProperties = {
  marginLeft: '0.5rem',
  color: THEME.accent,
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  textTransform: 'none',
  letterSpacing: 0,
  fontSize: '0.78rem',
};

const listStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  marginTop: '0.6rem',
  maxHeight: '420px',
  overflowY: 'auto',
};

const rowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '120px 1fr',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '0.35rem 0.5rem',
  background: 'transparent',
  border: `1px solid transparent`,
  borderRadius: '0.3rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
  textAlign: 'left',
};

const rowSelectedStyle: CSSProperties = {
  ...rowStyle,
  background: THEME.cardElevated,
  border: `1px solid ${THEME.borderStrong}`,
};

const boardLabelStyle: CSSProperties = {
  display: 'inline-flex',
  gap: '0.35rem',
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  fontWeight: 700,
  fontSize: '0.92rem',
};

const actionsStyle: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  fontSize: '0.78rem',
  color: THEME.textSecondary,
};
