// § 4: ボード概要 — 2 カラム並列 + 勝者ハイライト版。
//
// 要件 (2026-05-12 改修):
//   - OOP / IP を横並び 2 カラム (grid 1fr 1fr)
//   - 各カラム card 形式: [Badge OOP/IP] [Position] [role 右寄せ]
//                       + EV / EQ / EQR の 3 列 grid (内側 stats)
//   - 勝者カード (EV が大): 背景 #dcfce7 + 緑ボーダー #16a34a + 値 #15803d
//   - 同値 / どちらか null → 両方ニュートラル
//   - 中央に大きめ flop カード 3 枚
//   - role label (opener / caller / responder) 維持

import { type CSSProperties } from 'react';
import type {
  BoardSolution,
  FlopNode,
  PlayerSolution,
  PlayerTotal,
} from '../types/flop';
import type { Rank, Suit } from '../types/card';
import { PlayingCard } from './PlayingCard';
import {
  getFlopCaller,
  getFlopOpener,
  getFlopResponder,
} from '../data/flopVariants';
import type { Position } from '../types/strategy';
import { THEME } from '../styles/theme';
import { determineWinner } from './FlopBoardSummary.helpers';

interface Props {
  variant: string;
  data: FlopNode;
  selectedBoard?: BoardSolution | null;
}

export function FlopBoardSummary({ variant, data, selectedBoard }: Props) {
  const oopPlayer = data.players.find((p) => p.relative_position === 'OOP');
  const ipPlayer = data.players.find((p) => p.relative_position === 'IP');

  const statsSource: ReadonlyArray<PlayerTotal | PlayerSolution> =
    selectedBoard ? selectedBoard.player_solutions : data.player_totals;
  const oopStats = oopPlayer ? findStats(statsSource, oopPlayer.position) : null;
  const ipStats = ipPlayer ? findStats(statsSource, ipPlayer.position) : null;

  // 勝者判定: EV 大が勝者。null or 同値はニュートラル。
  const { oopWins, ipWins } = determineWinner(oopStats?.ev, ipStats?.ev);

  // role label
  const opener = getFlopOpener(variant);
  const caller = getFlopCaller(variant);
  const responder = getFlopResponder(variant);
  const roleOf = (p: Position): string =>
    buildRoleLabel(p, opener, caller, responder);

  const boardName = selectedBoard ? selectedBoard.name : data.game_point.game.board;
  const cards = parseBoardString(boardName);
  const street = data.game_point.game.current_street;

  return (
    <div className="flop-board-summary" style={containerStyle}>
      <div style={titleRowStyle}>
        <span style={titleStyle}>
          {selectedBoard ? `Selected: ${selectedBoard.name}` : 'Board Summary (range avg)'}
        </span>
      </div>

      {/* 2 カラム並列 (OOP / IP) */}
      <div style={twoColumnStyle}>
        {oopPlayer && (
          <PlayerCard
            badge="OOP"
            position={oopPlayer.position}
            role={roleOf(oopPlayer.position)}
            stats={oopStats}
            isWinner={oopWins}
          />
        )}
        {ipPlayer && (
          <PlayerCard
            badge="IP"
            position={ipPlayer.position}
            role={roleOf(ipPlayer.position)}
            stats={ipStats}
            isWinner={ipWins}
          />
        )}
      </div>

      {/* 中央: 大きめ flop カード 3 枚 */}
      <div className="flop-board-summary__board-row" style={boardRowStyle}>
        {cards.map((c, i) => (
          <BoardCardCell key={i} rank={c.rank} suit={c.suit} />
        ))}
      </div>

      {/* Pot / Active 表示 */}
      <div className="flop-board-summary__pot-row" style={potRowStyle}>
        <span style={potItemStyle}>
          <span style={potKeyStyle}>Pot</span>
          {street.start_pot}bb → {street.end_pot}bb
        </span>
        <span style={potItemStyle}>
          <span style={potKeyStyle}>Active</span>
          {data.game_point.game.active_position}
        </span>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function findStats(
  stats: ReadonlyArray<PlayerTotal | PlayerSolution>,
  pos: string,
): PlayerTotal | PlayerSolution | null {
  return stats.find((t) => t.position === pos) ?? null;
}

function parseBoardString(board: string): Array<{ rank: Rank; suit: Suit }> {
  const out: Array<{ rank: Rank; suit: Suit }> = [];
  for (let i = 0; i < board.length; i += 2) {
    out.push({ rank: board[i] as Rank, suit: board[i + 1] as Suit });
  }
  return out;
}

function buildRoleLabel(
  pos: Position,
  opener: Position,
  caller: Position,
  responder: Position,
): string {
  const isOpener = pos === opener;
  const isCaller = pos === caller;
  const isResponder = pos === responder;
  if (isOpener && isCaller) return 'opener · caller';
  if (isOpener) return 'opener';
  if (isCaller && isResponder) return 'caller · responder';
  if (isResponder) return 'responder';
  if (isCaller) return 'caller';
  return '';
}

function formatEV(v: number | null | undefined): string {
  return v != null ? v.toFixed(2) : '—';
}

function formatEQ(v: number | null | undefined): string {
  return v != null ? `${(v * 100).toFixed(1)}%` : '—';
}

function formatEQR(v: number | null | undefined): string {
  return v != null ? v.toFixed(2) : '—';
}

// ----------------------------------------------------------------------------
// PlayerCard
// ----------------------------------------------------------------------------

interface PlayerCardProps {
  badge: 'OOP' | 'IP';
  position: string;
  role: string;
  stats: PlayerTotal | PlayerSolution | null;
  isWinner: boolean;
}

function PlayerCard({ badge, position, role, stats, isWinner }: PlayerCardProps) {
  const cardStyle: CSSProperties = isWinner
    ? winnerCardStyle
    : neutralCardStyle;
  const positionColor = isWinner ? WIN_VALUE_COLOR : THEME.textPrimary;
  const roleColor = isWinner ? WIN_BORDER_COLOR : THEME.textMuted;
  const valueColor = isWinner ? WIN_VALUE_COLOR : THEME.textPrimary;

  return (
    <div className="flop-board-summary__card" style={cardStyle}>
      <div style={cardHeaderStyle}>
        <span className="flop-board-summary__badge" style={badgeStyle}>{badge}</span>
        <span
          className="flop-board-summary__position"
          style={{ ...positionLabelStyle, color: positionColor }}
        >
          {position}
        </span>
        {role && (
          <span
            className="flop-board-summary__role"
            style={{ ...roleLabelStyle, color: roleColor }}
          >
            {role}
          </span>
        )}
      </div>
      <div style={statsGridStyle}>
        <StatCell label="EV" value={formatEV(stats?.ev)} valueColor={valueColor} />
        <StatCell label="EQ" value={formatEQ(stats?.eq)} valueColor={valueColor} />
        <StatCell label="EQR" value={formatEQR(stats?.eqr)} valueColor={valueColor} />
      </div>
    </div>
  );
}

function StatCell({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor: string;
}) {
  return (
    <div>
      <div className="flop-board-summary__stat-label" style={statLabelStyle}>{label}</div>
      <div
        className="flop-board-summary__stat-value"
        style={{ ...statValueStyle, color: valueColor }}
      >
        {value}
      </div>
    </div>
  );
}

function BoardCardCell({ rank, suit }: { rank: Rank; suit: Suit }) {
  return <PlayingCard rank={rank} suit={suit} size="md" />;
}

// ----------------------------------------------------------------------------
// Style constants
// ----------------------------------------------------------------------------

const WIN_BG_COLOR = '#dcfce7';     // green-100
const WIN_BORDER_COLOR = '#16a34a'; // green-600
const WIN_VALUE_COLOR = '#15803d';  // green-700

const containerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.8rem',
  background: THEME.card,
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.5rem',
  padding: '0.95rem 1.1rem',
};

const titleRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
};

const titleStyle: CSSProperties = {
  fontSize: '0.7rem',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: THEME.textSecondary,
  fontWeight: 700,
};

const twoColumnStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '12px',
};

const neutralCardStyle: CSSProperties = {
  background: THEME.bg,
  border: `1px solid ${THEME.border}`,
  borderRadius: '8px',
  padding: '12px',
};

const winnerCardStyle: CSSProperties = {
  background: WIN_BG_COLOR,
  border: `1px solid ${WIN_BORDER_COLOR}`,
  borderRadius: '8px',
  padding: '12px',
};

const cardHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: '6px',
  marginBottom: '8px',
};

const badgeStyle: CSSProperties = {
  fontSize: '11px',
  padding: '2px 6px',
  background: 'white',
  borderRadius: '4px',
  color: '#6b7280',
  fontWeight: 500,
};

const positionLabelStyle: CSSProperties = {
  fontSize: '16px',
  fontWeight: 500,
};

const roleLabelStyle: CSSProperties = {
  fontSize: '11px',
  marginLeft: 'auto',
  fontStyle: 'italic',
};

const statsGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr',
  gap: '4px',
  fontSize: '12px',
};

const statLabelStyle: CSSProperties = {
  color: '#6b7280',
  fontSize: '10px',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
};

const statValueStyle: CSSProperties = {
  fontSize: '15px',
  fontWeight: 500,
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
};

// ----- Board cards (大きめ、中央) -----

const boardRowStyle: CSSProperties = {
  display: 'flex',
  gap: '0.65rem',
  justifyContent: 'center',
  padding: '0.45rem 0',
};

// ----- Pot / active row -----

const potRowStyle: CSSProperties = {
  display: 'flex',
  gap: '1rem',
  fontSize: '0.78rem',
  color: THEME.textSecondary,
  flexWrap: 'wrap',
  justifyContent: 'center',
};

const potItemStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.35rem',
};

const potKeyStyle: CSSProperties = {
  fontSize: '0.68rem',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: THEME.textMuted,
  fontWeight: 700,
};
