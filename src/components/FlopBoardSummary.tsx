// § 4: ボード概要 (Phase R3 で再設計、OOP/IP 横並び)。
//
// 元要件:
//   　　　　　UTG(original)　　　BB(caller)  (3bpとかなら逆になるこれも判定して)
//   EV
//   EQR
//
//   大きめにflopカード表示
//   「」　　　　「」　　　　「」
//
// 実装:
//   - 横並び 2 列: OOP (左) / IP (右)、各列に position + role + EV + EQ + EQR
//   - role label は variant の opener/caller/responder から動的判定
//   - 中央 (列下) に大きめの flop カード 3 枚

import { type CSSProperties } from 'react';
import type {
  BoardSolution,
  FlopNode,
  FlopPlayer,
  PlayerSolution,
  PlayerTotal,
} from '../types/flop';
import type { Rank, Suit } from '../types/card';
import { SUIT_COLOR, SUIT_SYMBOL } from '../types/card';
import {
  getFlopCaller,
  getFlopOpener,
  getFlopResponder,
} from '../data/flopVariants';
import type { Position } from '../types/strategy';
import { THEME } from '../styles/theme';

interface Props {
  variant: string;
  data: FlopNode;
  selectedBoard?: BoardSolution | null;
}

export function FlopBoardSummary({ variant, data, selectedBoard }: Props) {
  const oopPlayer = data.players.find((p) => p.relative_position === 'OOP');
  const ipPlayer = data.players.find((p) => p.relative_position === 'IP');

  // selectedBoard あれば player_solutions、なければ player_totals (range avg)
  const statsSource: ReadonlyArray<PlayerTotal | PlayerSolution> =
    selectedBoard ? selectedBoard.player_solutions : data.player_totals;

  const opener = getFlopOpener(variant);
  const caller = getFlopCaller(variant);
  const responder = getFlopResponder(variant);
  const roleOf = (p: Position): string => buildRoleLabel(p, opener, caller, responder);

  const boardName = selectedBoard ? selectedBoard.name : data.game_point.game.board;
  const cards = parseBoardString(boardName);
  const street = data.game_point.game.current_street;

  return (
    <div style={containerStyle}>
      <div style={titleRowStyle}>
        <span style={titleStyle}>
          {selectedBoard ? `Selected: ${selectedBoard.name}` : 'Board Summary (range avg)'}
        </span>
      </div>

      <div style={rowStyle}>
        {oopPlayer && (
          <PlayerColumn
            badge="OOP"
            player={oopPlayer}
            role={roleOf(oopPlayer.position)}
            stats={findStats(statsSource, oopPlayer.position)}
          />
        )}
        {ipPlayer && (
          <PlayerColumn
            badge="IP"
            player={ipPlayer}
            role={roleOf(ipPlayer.position)}
            stats={findStats(statsSource, ipPlayer.position)}
          />
        )}
      </div>

      <div style={boardRowStyle}>
        {cards.map((c, i) => (
          <BoardCardCell key={i} rank={c.rank} suit={c.suit} />
        ))}
      </div>

      <div style={potRowStyle}>
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
    out.push({
      rank: board[i] as Rank,
      suit: board[i + 1] as Suit,
    });
  }
  return out;
}

/**
 * Position に role label を割当て。variant 文脈で:
 *  - opener と caller が同じ (3bp 等): "opener / caller" 表記
 *  - opener のみ: "original"
 *  - caller のみ: "caller"
 *  - responder のみ (= 3bettor): "raiser"
 */
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

// ----------------------------------------------------------------------------
// Subcomponents
// ----------------------------------------------------------------------------

interface PlayerColumnProps {
  badge: 'OOP' | 'IP';
  player: FlopPlayer;
  role: string;
  stats: PlayerTotal | PlayerSolution | null;
}

function PlayerColumn({ badge, player, role, stats }: PlayerColumnProps) {
  return (
    <div style={columnStyle}>
      <div style={columnHeaderStyle}>
        <span style={posBadgeStyle(badge)}>{badge}</span>
        <span style={posNameStyle}>{player.position}</span>
      </div>
      {role && <div style={roleLabelStyle}>{role}</div>}
      <div style={statsListStyle}>
        <Stat label="EV" value={stats?.ev !== null && stats?.ev !== undefined ? stats.ev.toFixed(2) : '—'} />
        <Stat label="EQ" value={stats?.eq !== null && stats?.eq !== undefined ? `${(stats.eq * 100).toFixed(1)}%` : '—'} />
        <Stat label="EQR" value={stats?.eqr !== null && stats?.eqr !== undefined ? stats.eqr.toFixed(2) : '—'} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={statRowStyle}>
      <span style={statKeyStyle}>{label}</span>
      <span style={statValueStyle}>{value}</span>
    </div>
  );
}

function BoardCardCell({ rank, suit }: { rank: Rank; suit: Suit }) {
  return (
    <div style={cardCellStyle}>
      <span style={cardRankStyle}>{rank}</span>
      <span style={{ ...cardSuitStyle, color: SUIT_COLOR[suit] }}>{SUIT_SYMBOL[suit]}</span>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Styles
// ----------------------------------------------------------------------------

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
  justifyContent: 'flex-start',
};

const titleStyle: CSSProperties = {
  fontSize: '0.7rem',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: THEME.textSecondary,
  fontWeight: 700,
};

const rowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '1rem',
};

const columnStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.4rem',
};

const columnHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
};

function posBadgeStyle(label: 'OOP' | 'IP'): CSSProperties {
  return {
    display: 'inline-block',
    fontSize: '0.7rem',
    fontWeight: 700,
    padding: '0.18rem 0.5rem',
    borderRadius: '0.25rem',
    background: label === 'OOP' ? '#fef3c7' : '#dbeafe',
    color: label === 'OOP' ? '#92400e' : '#1e3a8a',
    minWidth: '36px',
    textAlign: 'center',
    letterSpacing: '0.06em',
  };
}

const posNameStyle: CSSProperties = {
  fontWeight: 700,
  fontSize: '1.05rem',
  color: THEME.textPrimary,
};

const roleLabelStyle: CSSProperties = {
  fontSize: '0.74rem',
  color: THEME.textMuted,
  fontStyle: 'italic',
  letterSpacing: '0.03em',
};

const statsListStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
};

const statRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  gap: '0.6rem',
};

const statKeyStyle: CSSProperties = {
  fontSize: '0.7rem',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: THEME.textMuted,
};

const statValueStyle: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  fontSize: '0.92rem',
  color: THEME.textPrimary,
  fontWeight: 600,
};

const boardRowStyle: CSSProperties = {
  display: 'flex',
  gap: '0.65rem',
  justifyContent: 'center',
  padding: '0.45rem 0',
};

const cardCellStyle: CSSProperties = {
  width: '64px',
  height: '88px',
  borderRadius: '0.5rem',
  background: '#fff',
  border: `2px solid ${THEME.borderStrong}`,
  boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.15rem',
};

const cardRankStyle: CSSProperties = {
  fontSize: '1.7rem',
  fontWeight: 700,
  color: '#1f2937',
  lineHeight: 1,
};

const cardSuitStyle: CSSProperties = {
  fontSize: '1.55rem',
  lineHeight: 1,
};

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
