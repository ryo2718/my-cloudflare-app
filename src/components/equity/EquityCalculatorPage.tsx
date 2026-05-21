// /equity: エクイティ計算 (フェーズ2)。
//   - ボードカード5スロット (フロップ3 | ターン1 | リバー1)。置いた枚数で
//     ストリートが自動で決まる (ストリートタブは廃止)。
//   - カード選択は2系統を併存:
//       * 個別スロットタップ → 1枚だけ選んで即確定
//       * 範囲ボタン [ボード]/[フロップ]/[ターンリバー]/各[ハンド] → 必要枚数を連続選択し
//         必要枚数で自動クローズ
//   - ボード各スロットの下にゴミ箱 (そのスロットのカードを削除)。
//   - プレイヤー4枚が揃い、ボードが 0/3/4/5 枚のとき自動で全列挙エクイティを計算
//     (ボード 1/2 枚は中途半端なので計算しない)。
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
  | { kind: 'board' }
  | { kind: 'flop' }
  | { kind: 'turnriver' }
  | { kind: 'player'; player: PlayerId }
  | { kind: 'boardSlot'; index: number }
  | { kind: 'playerSlot'; player: PlayerId; slot: SlotIdx };

// 計算対象になるボード枚数 (0=プリフロップ, 3=フロップ, 4=ターン, 5=リバー)。
const VALID_BOARD_COUNTS = new Set([0, 3, 4, 5]);

// 何枚目かを示す枠色。
const SEL_BLUE = '#2563eb';
const SEL_GREEN = '#16a34a';
const SEL_RED = '#dc2626';
const COLORS_BOARD = [SEL_BLUE, SEL_BLUE, SEL_BLUE, SEL_GREEN, SEL_RED];
const COLORS_FLOP = [SEL_BLUE, SEL_GREEN, SEL_RED];
const COLORS_TWO = [SEL_BLUE, SEL_GREEN];
const COLORS_NONE: string[] = [];

// 範囲が指すボードスロット番号 (個別 boardSlot も単一スロットとして扱う)。
function boardSlotsOf(target: SelectingTarget): number[] {
  if (target.kind === 'board') return [0, 1, 2, 3, 4];
  if (target.kind === 'flop') return [0, 1, 2];
  if (target.kind === 'turnriver') return [3, 4];
  if (target.kind === 'boardSlot') return [target.index];
  return [];
}

function rangeMax(target: SelectingTarget): number {
  if (target.kind === 'board') return 5;
  if (target.kind === 'flop') return 3;
  if (target.kind === 'turnriver' || target.kind === 'player') return 2;
  return 1; // boardSlot / playerSlot
}

function rangeColors(target: SelectingTarget): ReadonlyArray<string> {
  if (target.kind === 'board') return COLORS_BOARD;
  if (target.kind === 'flop') return COLORS_FLOP;
  if (target.kind === 'turnriver' || target.kind === 'player') return COLORS_TWO;
  return COLORS_NONE; // 個別 (max 1) は枠色なし
}

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

  const cancelSelection = () => setSelecting(null);

  // 選択結果を、対象が指すスロット順に格納してパネルを閉じる。
  const commitSelection = (cards: Card[]) => {
    if (!selecting) return;
    if (selecting.kind === 'player') {
      const player = selecting.player;
      setHands((prev) => ({ ...prev, [player]: [cards[0] ?? null, cards[1] ?? null] }));
    } else if (selecting.kind === 'playerSlot') {
      const { player, slot } = selecting;
      setHands((prev) => {
        const next = { ...prev, [player]: [...prev[player]] as [Card | null, Card | null] };
        next[player][slot] = cards[0] ?? null;
        return next;
      });
    } else {
      const slots = boardSlotsOf(selecting);
      setBoard((prev) => {
        const next = [...prev];
        slots.forEach((slot, i) => {
          next[slot] = cards[i] ?? null;
        });
        return next;
      });
    }
    setSelecting(null);
  };

  const resetPlayer = (player: PlayerId) => {
    setHands((prev) => ({ ...prev, [player]: [null, null] }));
  };

  const deleteBoardCard = (index: number) => {
    setBoard((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
  };

  // パネルに渡す初期選択 (この対象の既存カード) と他で使用中のカード。
  const initialSelected = useMemo<Card[]>(() => {
    if (!selecting) return [];
    if (selecting.kind === 'player') return hands[selecting.player].filter((c): c is Card => c !== null);
    if (selecting.kind === 'playerSlot') {
      const c = hands[selecting.player][selecting.slot];
      return c ? [c] : [];
    }
    return boardSlotsOf(selecting)
      .map((s) => board[s])
      .filter((c): c is Card => c !== null);
  }, [selecting, board, hands]);

  const usedByOthers = useMemo<Set<string>>(() => {
    const own = new Set<string>();
    if (selecting) {
      if (selecting.kind === 'player') {
        for (const c of hands[selecting.player]) if (c) own.add(cardToString(c));
      } else if (selecting.kind === 'playerSlot') {
        const c = hands[selecting.player][selecting.slot];
        if (c) own.add(cardToString(c));
      } else {
        for (const s of boardSlotsOf(selecting)) {
          const c = board[s];
          if (c) own.add(cardToString(c));
        }
      }
    }
    const s = new Set<string>();
    for (const k of usedCards) if (!own.has(k)) s.add(k);
    return s;
  }, [usedCards, selecting, board, hands]);

  const equityText = (p: PlayerId): string => {
    if (computing) return '計算中…';
    if (result) return `${(p === 'A' ? result.a : result.b).toFixed(1)}%`;
    return '';
  };

  const renderBoardCell = (i: number) => (
    <div style={boardCellStyle}>
      <CardSlot
        card={board[i]}
        active={selecting?.kind === 'boardSlot' && selecting.index === i}
        onClick={() => openSelector({ kind: 'boardSlot', index: i })}
      />
      <button
        type="button"
        onClick={() => deleteBoardCard(i)}
        disabled={!board[i]}
        aria-label={`ボード${i + 1}枚目を削除`}
        style={board[i] ? trashBtnStyle : trashHiddenStyle}
      >
        <TrashIcon />
      </button>
    </div>
  );

  return (
    <div style={pageStyle}>
      <AppHeader showBack />
      <main style={mainStyle}>
        <Link to="/" style={crumbStyle}>← ホーム</Link>
        <h1 style={titleStyle}>エクイティ計算</h1>

        <div style={rowsContainerStyle}>
        <div style={boardSectionStyle}>
          <span style={rowLabelStyle}>ボード</span>
          <div style={boardColumnStyle}>
            <button type="button" style={rangeBtnFullStyle} onClick={() => openSelector({ kind: 'board' })}>
              ボード
            </button>
            <div style={boardRangesRowStyle}>
              <div style={boardGroupStyle}>
                <button type="button" style={rangeBtnFullStyle} onClick={() => openSelector({ kind: 'flop' })}>
                  フロップ
                </button>
                <div style={slotsRowStyle}>
                  {renderBoardCell(0)}
                  {renderBoardCell(1)}
                  {renderBoardCell(2)}
                </div>
              </div>
              <div style={boardGroupStyle}>
                <button type="button" style={rangeBtnFullStyle} onClick={() => openSelector({ kind: 'turnriver' })}>
                  ターンリバー
                </button>
                <div style={slotsRowStyle}>
                  {renderBoardCell(3)}
                  <div style={slotDividerStyle} />
                  {renderBoardCell(4)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={dividerStyle} />

        {(['A', 'B'] as PlayerId[]).map((p) => (
          <div key={p} style={playerRowStyle}>
            <span style={rowLabelStyle}>Player {p}</span>
            <div style={cardColStyle}>
              <div style={slotsStyle}>
                <CardSlot
                  card={hands[p][0]}
                  active={selecting?.kind === 'playerSlot' && selecting.player === p && selecting.slot === 0}
                  onClick={() => openSelector({ kind: 'playerSlot', player: p, slot: 0 })}
                />
                <CardSlot
                  card={hands[p][1]}
                  active={selecting?.kind === 'playerSlot' && selecting.player === p && selecting.slot === 1}
                  onClick={() => openSelector({ kind: 'playerSlot', player: p, slot: 1 })}
                />
              </div>
              <button type="button" style={handBtnStyle} onClick={() => openSelector({ kind: 'player', player: p })}>
                ハンド
              </button>
            </div>
            <span style={equityStyle}>{equityText(p)}</span>
            <button type="button" style={rangeBtnStyle} onClick={() => setInfo('レンジ指定は準備中です')}>
              レンジ
            </button>
            <button type="button" style={rangeBtnStyle} onClick={() => resetPlayer(p)}>
              リセット
            </button>
          </div>
        ))}

        <div style={dividerStyle} />
        </div>

        {!allSet && <p style={hintStyle}>各プレイヤーのカードを2枚ずつ選ぶと自動で勝率を計算します。</p>}
        {allSet && !VALID_BOARD_COUNTS.has(boardCount) && (
          <p style={hintStyle}>ボードを3枚以上にすると計算します。</p>
        )}
        {info && <p style={infoStyle}>{info}</p>}

        {selecting && (
          <CardSelector
            max={rangeMax(selecting)}
            selectionColors={rangeColors(selecting)}
            initialSelected={initialSelected}
            usedByOthers={usedByOthers}
            onCommit={commitSelection}
            onCancel={cancelSelection}
          />
        )}
      </main>
    </div>
  );
}

// 絵文字を使わないゴミ箱アイコン (Feather 系のアウトライン)。
function TrashIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
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

// ボード行・プレイヤー行を同じ幅にまとめる。幅はプレイヤー行 (最右=リセット) の自然幅に
// 一致し、ボードはその幅に展開される → 全行の右端がリセット右端に揃う。
const rowsContainerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  width: 'fit-content',
  maxWidth: '100%',
  gap: '0.9rem',
};

const boardSectionStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.25rem 0' };
const boardColumnStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  gap: '0.4rem',
  width: '100%',
};
// フロップ群を左端・ターンリバー群を右端に寄せ、ボード右端を行の右端に揃える。
const boardRangesRowStyle: CSSProperties = { display: 'flex', alignItems: 'stretch', justifyContent: 'space-between' };
const boardGroupStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.35rem' };
const slotsRowStyle: CSSProperties = { display: 'flex', gap: '0.35rem', alignItems: 'flex-start' };
const boardCellStyle: CSSProperties = {
  width: 44,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.3rem',
};
const slotDividerStyle: CSSProperties = { width: 1, alignSelf: 'stretch', background: THEME.border, margin: '0 0.1rem' };

const trashBtnStyle: CSSProperties = {
  width: 44,
  height: 28,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#fff',
  color: THEME.textSecondary,
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.4rem',
  cursor: 'pointer',
  padding: 0,
};
const trashHiddenStyle: CSSProperties = { ...trashBtnStyle, visibility: 'hidden', cursor: 'default' };

const playerRowStyle: CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: '0.55rem', flexWrap: 'wrap', padding: '0.5rem 0' };
const rowLabelStyle: CSSProperties = { fontSize: '0.92rem', fontWeight: 700, color: THEME.textPrimary, minWidth: 64 };
// カード2枚と [ハンド] ボタンを縦に積む列。ハンドはカード2枚分の幅。
const cardColStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.4rem' };
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
const rangeBtnFullStyle: CSSProperties = { ...rangeBtnStyle, width: '100%', textAlign: 'center' };
const handBtnStyle: CSSProperties = { ...rangeBtnStyle, width: '100%', textAlign: 'center' };
const equityStyle: CSSProperties = {
  fontSize: '1.1rem',
  fontWeight: 800,
  color: THEME.accent,
  fontVariantNumeric: 'tabular-nums',
  minWidth: 64,
  textAlign: 'right',
};
const hintStyle: CSSProperties = { fontSize: '0.85rem', color: THEME.textMuted };
const infoStyle: CSSProperties = { fontSize: '0.85rem', color: THEME.textSecondary };
