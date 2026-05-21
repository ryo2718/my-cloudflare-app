// /equity: エクイティ計算 (フェーズ2)。
//   - ボードカード5スロット (フロップ3 + ターン1 + リバー1)。置いた枚数で
//     ストリートが自動で決まる (ストリートタブは廃止)。
//   - Player A / B の 2 人固定。各 2 枚のカードスロット + レンジ(未実装) + リセット
//   - スロットをタップ → 画面上部にカード選択ポップアップ
//   - プレイヤー4枚が揃い、ボードが 0/3/4/5 枚のとき自動で全列挙エクイティを計算
//     (ボード 1/2 枚は中途半端なので計算しない)
//
// 未実装: レンジ指定・3人以上。

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { AppHeader } from '../AppHeader';
import { Link } from '../../router/router';
import { THEME } from '../../styles/theme';
import { cardToString, type Card } from '../../types/card';
import { computeEquity, type EquityResult } from '../../utils/equity';
import { CardSlot } from './CardSlot';
import { CardSelector } from './CardSelector';

type PlayerId = 'A' | 'B';
type SlotIdx = 0 | 1;

type SelectingTarget =
  | { kind: 'player'; player: PlayerId; slot: SlotIdx }
  | { kind: 'board'; index: number };

// 計算対象になるボード枚数 (0=プリフロップ, 3=フロップ, 4=ターン, 5=リバー)。
const VALID_BOARD_COUNTS = new Set([0, 3, 4, 5]);

export function EquityCalculatorPage() {
  const [hands, setHands] = useState<Record<PlayerId, [Card | null, Card | null]>>({
    A: [null, null],
    B: [null, null],
  });
  const [board, setBoard] = useState<(Card | null)[]>([null, null, null, null, null]);
  const [selecting, setSelecting] = useState<SelectingTarget | null>(null);
  const [result, setResult] = useState<EquityResult | null>(null);
  const [computing, setComputing] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  // 使用中カード集合 (重複防止 + 選択不可表示)。プレイヤー + ボード全体。
  const usedCards = useMemo(() => {
    const set = new Set<string>();
    for (const p of ['A', 'B'] as PlayerId[]) {
      for (const c of hands[p]) if (c) set.add(cardToString(c));
    }
    for (const c of board) if (c) set.add(cardToString(c));
    return set;
  }, [hands, board]);

  const allSet = !!(hands.A[0] && hands.A[1] && hands.B[0] && hands.B[1]);
  const boardCards = useMemo(() => board.filter((c): c is Card => c !== null), [board]);
  const boardCount = boardCards.length;

  const a0 = hands.A[0] ? cardToString(hands.A[0]!) : '';
  const a1 = hands.A[1] ? cardToString(hands.A[1]!) : '';
  const b0 = hands.B[0] ? cardToString(hands.B[0]!) : '';
  const b1 = hands.B[1] ? cardToString(hands.B[1]!) : '';
  const boardKey = board.map((c) => (c ? cardToString(c) : '_')).join('');

  // プレイヤー4枚が揃い、ボードが 0/3/4/5 枚なら自動計算。
  // プリフロップは重い (約170万通り) のでペイント後に setTimeout で実行。
  useEffect(() => {
    if (!allSet || !VALID_BOARD_COUNTS.has(boardCount)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResult(null);
      setComputing(false);
      return;
    }
    setComputing(true);
    setResult(null);
    const t = window.setTimeout(() => {
      const r = computeEquity(
        [hands.A[0]!, hands.A[1]!],
        [hands.B[0]!, hands.B[1]!],
        boardCards,
      );
      setResult(r);
      setComputing(false);
    }, 30);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSet, boardCount, a0, a1, b0, b1, boardKey]);

  const openSelector = (target: SelectingTarget) => {
    setInfo(null);
    setSelecting(target);
  };

  const pickCard = (card: Card) => {
    if (!selecting) return;
    if (selecting.kind === 'player') {
      const { player, slot } = selecting;
      setHands((prev) => {
        const next = { ...prev, [player]: [...prev[player]] as [Card | null, Card | null] };
        next[player][slot] = card;
        return next;
      });
    } else {
      const { index } = selecting;
      setBoard((prev) => {
        const next = [...prev];
        next[index] = card;
        return next;
      });
    }
    setSelecting(null);
  };

  const resetPlayer = (player: PlayerId) => {
    setHands((prev) => ({ ...prev, [player]: [null, null] }));
  };

  const resetBoard = () => {
    setBoard([null, null, null, null, null]);
  };

  // 選択中スロットの現在のカードは選び直せるよう usedCards から除外。
  const selectorUsed = useMemo(() => {
    if (!selecting) return usedCards;
    const cur =
      selecting.kind === 'player' ? hands[selecting.player][selecting.slot] : board[selecting.index];
    if (!cur) return usedCards;
    const s = new Set(usedCards);
    s.delete(cardToString(cur));
    return s;
  }, [usedCards, selecting, hands, board]);

  const equityText = (p: PlayerId): string => {
    if (computing) return '計算中…';
    if (result) return `${(p === 'A' ? result.a : result.b).toFixed(1)}%`;
    return '';
  };

  return (
    <div style={pageStyle}>
      <AppHeader showBack />
      <main style={mainStyle}>
        <Link to="/" style={crumbStyle}>← ホーム</Link>
        <h1 style={titleStyle}>エクイティ計算</h1>

        <div style={boardRowStyle}>
          <span style={rowLabelStyle}>ボード</span>
          <div style={boardSlotsStyle}>
            {board.map((c, i) => (
              <CardSlot
                key={i}
                card={c}
                active={selecting?.kind === 'board' && selecting.index === i}
                onClick={() => openSelector({ kind: 'board', index: i })}
              />
            ))}
          </div>
          <button type="button" style={resetBtnStyle} onClick={resetBoard}>
            リセット
          </button>
        </div>

        <div style={dividerStyle} />

        {(['A', 'B'] as PlayerId[]).map((p) => (
          <div key={p} style={playerRowStyle}>
            <span style={rowLabelStyle}>Player {p}</span>
            <div style={slotsStyle}>
              <CardSlot
                card={hands[p][0]}
                active={selecting?.kind === 'player' && selecting.player === p && selecting.slot === 0}
                onClick={() => openSelector({ kind: 'player', player: p, slot: 0 })}
              />
              <CardSlot
                card={hands[p][1]}
                active={selecting?.kind === 'player' && selecting.player === p && selecting.slot === 1}
                onClick={() => openSelector({ kind: 'player', player: p, slot: 1 })}
              />
            </div>
            <button type="button" style={rangeBtnStyle} onClick={() => setInfo('レンジ指定は準備中です')}>
              レンジ
            </button>
            <button type="button" style={resetBtnStyle} onClick={() => resetPlayer(p)}>
              リセット
            </button>
            <span style={equityStyle}>{equityText(p)}</span>
          </div>
        ))}

        <div style={dividerStyle} />

        {!allSet && <p style={hintStyle}>各プレイヤーのカードを2枚ずつ選ぶと自動で勝率を計算します。</p>}
        {allSet && !VALID_BOARD_COUNTS.has(boardCount) && (
          <p style={hintStyle}>ボードを3枚以上にすると計算します。</p>
        )}
        {info && <p style={infoStyle}>{info}</p>}

        {selecting && (
          <CardSelector usedCards={selectorUsed} onSelect={pickCard} onClose={() => setSelecting(null)} />
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const pageStyle: CSSProperties = { minHeight: '100vh', background: THEME.bg, display: 'flex', flexDirection: 'column' };
const mainStyle: CSSProperties = {
  flex: 1,
  padding: '1.25rem 1rem',
  maxWidth: 560,
  width: '100%',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.9rem',
};
const crumbStyle: CSSProperties = { fontSize: '0.82rem', color: THEME.textSecondary, textDecoration: 'none' };
const titleStyle: CSSProperties = { margin: 0, fontSize: '1.25rem', fontWeight: 700, color: THEME.textPrimary };
const dividerStyle: CSSProperties = { height: 1, background: THEME.border };
const boardRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.55rem',
  flexWrap: 'wrap',
  padding: '0.5rem 0',
};
const boardSlotsStyle: CSSProperties = { display: 'flex', gap: '0.35rem' };
const playerRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.55rem',
  flexWrap: 'wrap',
  padding: '0.5rem 0',
};
const rowLabelStyle: CSSProperties = { fontSize: '0.92rem', fontWeight: 700, color: THEME.textPrimary, minWidth: 64 };
const slotsStyle: CSSProperties = { display: 'flex', gap: '0.35rem' };
const rangeBtnStyle: CSSProperties = {
  padding: '0.4rem 0.7rem',
  background: '#fff',
  color: THEME.textSecondary,
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.4rem',
  fontSize: '0.82rem',
  fontFamily: 'inherit',
  cursor: 'pointer',
};
const resetBtnStyle: CSSProperties = { ...rangeBtnStyle };
const equityStyle: CSSProperties = {
  marginLeft: 'auto',
  fontSize: '1.1rem',
  fontWeight: 800,
  color: THEME.accent,
  fontVariantNumeric: 'tabular-nums',
  minWidth: 64,
  textAlign: 'right',
};
const hintStyle: CSSProperties = { fontSize: '0.85rem', color: THEME.textMuted };
const infoStyle: CSSProperties = { fontSize: '0.85rem', color: THEME.textSecondary };
