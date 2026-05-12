// ボード概要カード: OOP / IP ラベル + EV / EQ / EQR + 大きめ flop カード + pot。
//
// 数値表示 ⇄ Visual (EQ をプログレスバー) を 1 つのトグルで切替 (Q5 確定済、
// ボード概要のみが対象)。EV は絶対値で正規化困難なため数値固定、EQ のみゲージ化。

import { useState, type CSSProperties } from 'react';
import type {
  BoardSolution,
  FlopNode,
  FlopPlayer,
  PlayerSolution,
  PlayerTotal,
} from '../types/flop';
import type { Rank, Suit } from '../types/card';
import { SUIT_COLOR, SUIT_SYMBOL } from '../types/card';
import { THEME } from '../styles/theme';

interface Props {
  data: FlopNode;
  /**
   * 選択中の board solution。指定時:
   *  - board cards: 選択 board の cards (data.game_point.game.board ではなく)
   *  - player stats: solution.player_solutions (range avg の player_totals ではなく)
   *  - タイトルに「Selected: <board>」を表示
   */
  selectedBoard?: BoardSolution | null;
}

export function FlopBoardSummary({ data, selectedBoard }: Props) {
  const [visual, setVisual] = useState(false);

  const oop = data.players.find((p) => p.relative_position === 'OOP');
  const ip = data.players.find((p) => p.relative_position === 'IP');

  // selectedBoard あれば player_solutions を、なければ player_totals を使う
  const statsSource: ReadonlyArray<PlayerTotal | PlayerSolution> =
    selectedBoard ? selectedBoard.player_solutions : data.player_totals;

  const oopTotals = oop ? findStats(statsSource, oop.position) : null;
  const ipTotals = ip ? findStats(statsSource, ip.position) : null;

  // selectedBoard あればその name を、なければ data の board を使う
  const boardName = selectedBoard ? selectedBoard.name : data.game_point.game.board;
  const boardCards = parseBoardString(boardName);
  const street = data.game_point.game.current_street;

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <span style={titleStyle}>
          {selectedBoard ? `Selected: ${selectedBoard.name}` : 'Board Summary (range avg)'}
        </span>
        <button
          type="button"
          onClick={() => setVisual(!visual)}
          style={modeToggleStyle}
          title="数値 ⇄ ゲージ 切替"
        >
          {visual ? 'Numeric' : 'Visual'}
        </button>
      </div>

      {oop && oopTotals && (
        <PlayerRow label="OOP" player={oop} totals={oopTotals} visual={visual} />
      )}
      {ip && ipTotals && (
        <PlayerRow label="IP" player={ip} totals={ipTotals} visual={visual} />
      )}

      <div style={boardRowStyle}>
        {boardCards.map((c, i) => (
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
  // "QsTs7h" → [{Q,s}, {T,s}, {7,h}]
  const out: Array<{ rank: Rank; suit: Suit }> = [];
  for (let i = 0; i < board.length; i += 2) {
    out.push({
      rank: board[i] as Rank,
      suit: board[i + 1] as Suit,
    });
  }
  return out;
}

// ----------------------------------------------------------------------------
// Subcomponents
// ----------------------------------------------------------------------------

interface PlayerRowProps {
  label: 'OOP' | 'IP';
  player: FlopPlayer;
  totals: PlayerTotal | PlayerSolution;
  visual: boolean;
}

function PlayerRow({ label, player, totals, visual }: PlayerRowProps) {
  return (
    <div style={playerRowStyle}>
      <span style={posBadgeStyle(label)}>{label}</span>
      <span style={posNameStyle}>{player.position}</span>
      <Stat name="EV" value={totals.ev !== null ? totals.ev.toFixed(2) : '—'} />
      <StatEQ value={totals.eq} visual={visual} />
      <Stat name="EQR" value={totals.eqr !== null ? totals.eqr.toFixed(2) : '—'} />
    </div>
  );
}

function Stat({ name, value }: { name: string; value: string }) {
  return (
    <span style={statStyle}>
      <span style={statKeyStyle}>{name}</span>
      <span style={statValueStyle}>{value}</span>
    </span>
  );
}

function StatEQ({ value, visual }: { value: number | null; visual: boolean }) {
  const pct = value !== null ? value * 100 : null;
  return (
    <span style={statStyle}>
      <span style={statKeyStyle}>EQ</span>
      <span style={statValueStyle}>
        {pct !== null ? `${pct.toFixed(1)}%` : '—'}
      </span>
      {visual && pct !== null && (
        <span style={gaugeOuterStyle}>
          <span style={{ ...gaugeInnerStyle, width: `${Math.min(100, Math.max(0, pct))}%` }} />
        </span>
      )}
    </span>
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
  gap: '0.55rem',
  background: THEME.card,
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.5rem',
  padding: '0.85rem 1rem',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const titleStyle: CSSProperties = {
  fontSize: '0.7rem',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: THEME.textSecondary,
  fontWeight: 700,
};

const modeToggleStyle: CSSProperties = {
  background: THEME.cardElevated,
  color: THEME.textSecondary,
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.3rem',
  padding: '0.2rem 0.6rem',
  fontSize: '0.72rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const playerRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.7rem',
  flexWrap: 'wrap',
  fontSize: '0.86rem',
  color: THEME.textPrimary,
};

function posBadgeStyle(label: 'OOP' | 'IP'): CSSProperties {
  return {
    display: 'inline-block',
    fontSize: '0.7rem',
    fontWeight: 700,
    padding: '0.15rem 0.45rem',
    borderRadius: '0.25rem',
    background: label === 'OOP' ? '#fef3c7' : '#dbeafe',
    color: label === 'OOP' ? '#92400e' : '#1e3a8a',
    minWidth: '34px',
    textAlign: 'center',
    letterSpacing: '0.06em',
  };
}

const posNameStyle: CSSProperties = {
  fontWeight: 700,
  minWidth: '36px',
  color: THEME.textPrimary,
};

const statStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.3rem',
};

const statKeyStyle: CSSProperties = {
  fontSize: '0.7rem',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: THEME.textMuted,
};

const statValueStyle: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  fontSize: '0.85rem',
  color: THEME.textPrimary,
  fontWeight: 600,
};

const gaugeOuterStyle: CSSProperties = {
  display: 'inline-block',
  width: '60px',
  height: '8px',
  background: THEME.bg,
  border: `1px solid ${THEME.border}`,
  borderRadius: '4px',
  overflow: 'hidden',
};

const gaugeInnerStyle: CSSProperties = {
  display: 'block',
  height: '100%',
  background: '#047857',
};

const boardRowStyle: CSSProperties = {
  display: 'flex',
  gap: '0.6rem',
  justifyContent: 'center',
  padding: '0.45rem 0',
};

const cardCellStyle: CSSProperties = {
  width: '52px',
  height: '70px',
  borderRadius: '0.4rem',
  background: '#fff',
  border: `1.5px solid ${THEME.borderStrong}`,
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.1rem',
};

const cardRankStyle: CSSProperties = {
  fontSize: '1.45rem',
  fontWeight: 700,
  color: '#1f2937',
  lineHeight: 1,
};

const cardSuitStyle: CSSProperties = {
  fontSize: '1.3rem',
  lineHeight: 1,
};

const potRowStyle: CSSProperties = {
  display: 'flex',
  gap: '1rem',
  fontSize: '0.78rem',
  color: THEME.textSecondary,
  flexWrap: 'wrap',
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
