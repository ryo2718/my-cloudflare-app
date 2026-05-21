// /equity: エクイティ計算 (フェーズ2)。
//   - ボードカード5スロット (フロップ3 | ターン1 | リバー1)。置いた枚数で
//     ストリートが自動で決まる (ストリートタブは廃止)。
//   - カード選択は2系統を併存:
//       * 個別スロットタップ → 1枚だけ選んで即確定
//       * 範囲ボタン [ボード]/[フロップ]/[ターンリバー]/各[ハンド] → 必要枚数を連続選択し
//         必要枚数で自動クローズ
//   - ボード各スロットの下にゴミ箱 (そのスロットのカードを削除)。
//   - 各プレイヤーは具体ハンド or レンジ (13×13 マトリクス) を排他で設定可能。
//   - 両者が設定済み + ボードが 0/3/4/5 枚のとき自動でエクイティを計算
//     (具体ハンド同士は全列挙、レンジが絡む場合は rangeEquity が全列挙/モンテカルロを自動選択)。
//
// 未実装: 3人以上。

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { AppHeader } from '../AppHeader';
import { Link } from '../../router/router';
import { THEME } from '../../styles/theme';
import { cardToString, type Card } from '../../types/card';
import { computeEquity } from '../../utils/equity';
import { cardToInt } from '../../utils/handEvaluator';
import { computeRangeEquity } from '../../utils/rangeEquity';
import { TOTAL_COMBOS, weightedCombos, type WeightedCombo } from '../../utils/combos';
import { presetLabel, type AppliedPreset } from '../../utils/presetRange';
import { equityOutcome } from '../../utils/equityColor';
import { CardSlot } from './CardSlot';
import { CardSelector } from './CardSelector';
import { RangeMatrix } from './RangeMatrix';

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

// 勝率の勝敗色 (緑=コール系 / 赤=レイズ系)。引分は中立 (THEME.accent)。
const WIN_COLOR = '#3B8A1E';
const LOSE_COLOR = '#D8443C';

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

/** 2 つの weight マップが完全一致か (編集済み判定用)。 */
function mapsEqual(a: ReadonlyMap<string, number>, b: ReadonlyMap<string, number>): boolean {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) if (b.get(k) !== v) return false;
  return true;
}

export function EquityCalculatorPage() {
  const [hands, setHands] = useState<Record<PlayerId, [Card | null, Card | null]>>({
    A: [null, null],
    B: [null, null],
  });
  const [board, setBoard] = useState<(Card | null)[]>([null, null, null, null, null]);
  // 各プレイヤーのレンジ (コンボ key → weight 0..1)。size>0 ならレンジモード
  // (具体ハンドとは排他)。weight は GTO 頻度由来 (黄=1 / 緑=0<w<1)。
  const [ranges, setRanges] = useState<Record<PlayerId, Map<string, number>>>({
    A: new Map(),
    B: new Map(),
  });
  // 適用中プリセット (吹き出し表示 + 編集済み判定用)。プリセット未使用なら null。
  const [presets, setPresets] = useState<Record<PlayerId, AppliedPreset | null>>({
    A: null,
    B: null,
  });
  const [selecting, setSelecting] = useState<SelectingTarget | null>(null);
  const [rangeEditing, setRangeEditing] = useState<PlayerId | null>(null);
  const [result, setResult] = useState<{ a: number; b: number } | null>(null);
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

  const boardCards = useMemo(() => board.filter((c): c is Card => c !== null), [board]);
  const boardCount = boardCards.length;

  // 各プレイヤーが「設定済み」か (レンジ size>0 か、具体ハンド2枚)。
  const aRange = ranges.A.size > 0;
  const bRange = ranges.B.size > 0;
  const aReady = aRange || !!(hands.A[0] && hands.A[1]);
  const bReady = bRange || !!(hands.B[0] && hands.B[1]);
  const bothReady = aReady && bReady;

  const a0 = hands.A[0] ? cardToString(hands.A[0]!) : '';
  const a1 = hands.A[1] ? cardToString(hands.A[1]!) : '';
  const b0 = hands.B[0] ? cardToString(hands.B[0]!) : '';
  const b1 = hands.B[1] ? cardToString(hands.B[1]!) : '';
  const boardKey = board.map((c) => (c ? cardToString(c) : '_')).join('');
  const rangeKey = useMemo(() => {
    const ser = (m: Map<string, number>) =>
      [...m.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1)).map(([k, w]) => `${k}${w}`).join('');
    return `A${ser(ranges.A)}B${ser(ranges.B)}`;
  }, [ranges]);

  // 両者が設定済み + ボードが 0/3/4/5 枚なら自動計算。
  // 重い (プリフロップ全列挙 / レンジ計算) のでペイント後に setTimeout で実行。
  useEffect(() => {
    if (!bothReady || !VALID_BOARD_COUNTS.has(boardCount)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResult(null);
      setComputing(false);
      return;
    }
    setComputing(true);
    setResult(null);
    const t = window.setTimeout(() => {
      if (!aRange && !bRange) {
        // 具体ハンド同士は既存の正確計算を使う。
        const r = computeEquity([hands.A[0]!, hands.A[1]!], [hands.B[0]!, hands.B[1]!], boardCards);
        setResult({ a: r.a, b: r.b });
      } else {
        const aCombos: WeightedCombo[] = aRange
          ? weightedCombos(ranges.A)
          : [[cardToInt(hands.A[0]!), cardToInt(hands.A[1]!), 1]];
        const bCombos: WeightedCombo[] = bRange
          ? weightedCombos(ranges.B)
          : [[cardToInt(hands.B[0]!), cardToInt(hands.B[1]!), 1]];
        const r = computeRangeEquity(aCombos, bCombos, boardCards.map(cardToInt));
        setResult({ a: r.a, b: r.b });
      }
      setComputing(false);
    }, 30);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bothReady, aRange, bRange, boardCount, a0, a1, b0, b1, boardKey, rangeKey]);

  const openSelector = (target: SelectingTarget) => {
    setInfo(null);
    setSelecting(target);
  };

  const cancelSelection = () => setSelecting(null);

  // 具体ハンドを設定したらそのプレイヤーのレンジ・プリセットは解除 (排他)。
  const clearRange = (player: PlayerId) => {
    setRanges((prev) => (prev[player].size ? { ...prev, [player]: new Map<string, number>() } : prev));
    setPresets((prev) => (prev[player] ? { ...prev, [player]: null } : prev));
  };

  // 選択結果を、対象が指すスロット順に格納してパネルを閉じる。
  const commitSelection = (cards: Card[]) => {
    if (!selecting) return;
    if (selecting.kind === 'player') {
      const player = selecting.player;
      setHands((prev) => ({ ...prev, [player]: [cards[0] ?? null, cards[1] ?? null] }));
      clearRange(player);
    } else if (selecting.kind === 'playerSlot') {
      const { player, slot } = selecting;
      setHands((prev) => {
        const next = { ...prev, [player]: [...prev[player]] as [Card | null, Card | null] };
        next[player][slot] = cards[0] ?? null;
        return next;
      });
      clearRange(player);
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
    clearRange(player);
  };

  const openRange = (player: PlayerId) => {
    setInfo(null);
    setRangeEditing(player);
  };

  // レンジ確定: 設定するとそのプレイヤーの具体ハンドはクリア (排他)。
  const commitRange = (range: Map<string, number>, preset: AppliedPreset | null) => {
    if (!rangeEditing) return;
    const player = rangeEditing;
    setRanges((prev) => ({ ...prev, [player]: range }));
    setPresets((prev) => ({ ...prev, [player]: preset }));
    if (range.size > 0) setHands((prev) => ({ ...prev, [player]: [null, null] }));
    setRangeEditing(null);
  };

  const cancelRange = () => setRangeEditing(null);

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

  // レンジ編集中プレイヤーの相手が「確定ハンド(2枚)」を持つなら、その2枚を除外対象に。
  // 相手がレンジ・未設定なら除外しない (レンジ同士はカード重複しうる)。
  const opponentLockedCards = useMemo<Card[]>(() => {
    if (!rangeEditing) return [];
    const opp: PlayerId = rangeEditing === 'A' ? 'B' : 'A';
    if (ranges[opp].size > 0) return [];
    const [c0, c1] = hands[opp];
    return c0 && c1 ? [c0, c1] : [];
  }, [rangeEditing, ranges, hands]);

  const equityText = (p: PlayerId): string => {
    if (computing) return '計算中…';
    if (result) return `${(p === 'A' ? result.a : result.b).toFixed(1)}%`;
    return '';
  };

  // 勝敗で色分け: 勝ち=緑 / 負け=赤 / 引分(丸め後同値)=中立(既存茶系)。
  const equityColorFor = (p: PlayerId): string => {
    if (computing || !result) return THEME.accent;
    const o = equityOutcome(result.a, result.b, p === 'A' ? 'a' : 'b');
    return o === 'win' ? WIN_COLOR : o === 'lose' ? LOSE_COLOR : THEME.accent;
  };

  const renderBoardCell = (i: number) => (
    <div style={boardCellStyle}>
      <CardSlot
        card={board[i]}
        size="board"
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
              <div style={groupDividerStyle} />
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

        {(['A', 'B'] as PlayerId[]).map((p) => {
          const rangeSize = ranges[p].size;
          const preset = presets[p];
          const presetText =
            rangeSize > 0 && preset
              ? presetLabel(preset.info, !mapsEqual(ranges[p], preset.snapshot))
              : null;
          return (
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
              <div style={rightBlockStyle}>
                {equityText(p) && (
                  <span style={{ ...equityStyle, color: equityColorFor(p) }}>{equityText(p)}</span>
                )}
                <div style={rangeBtnsRowStyle}>
                  <button
                    type="button"
                    style={rangeSize > 0 ? rangeBtnActiveStyle : rangeBtnStyle}
                    onClick={() => openRange(p)}
                  >
                    レンジ
                  </button>
                  <button type="button" style={rangeBtnStyle} onClick={() => resetPlayer(p)}>
                    リセット
                  </button>
                </div>
                {rangeSize > 0 && (
                  <span style={rangeBadgeStyle}>
                    レンジ {rangeSize}コンボ ({((rangeSize / TOTAL_COMBOS) * 100).toFixed(1)}%)
                  </span>
                )}
                {presetText && <span style={presetBubbleStyle}>{presetText}</span>}
              </div>
            </div>
          );
        })}

        <div style={dividerStyle} />

        {bothReady && !VALID_BOARD_COUNTS.has(boardCount) && (
          <p style={hintStyle}>ボードを3枚以上にすると計算します。</p>
        )}
        {info && <p style={infoStyle}>{info}</p>}

        {selecting && (
          <CardSelector
            max={rangeMax(selecting)}
            initialSelected={initialSelected}
            usedByOthers={usedByOthers}
            onCommit={commitSelection}
            onCancel={cancelSelection}
          />
        )}

        {rangeEditing && (
          <RangeMatrix
            initialRange={ranges[rangeEditing]}
            initialPreset={presets[rangeEditing]}
            board={boardCards}
            opponentCards={opponentLockedCards}
            onCommit={commitRange}
            onCancel={cancelRange}
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
      width="18"
      height="18"
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

const boardSectionStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.25rem 0' };
// ボードは縦長カードでコンパクトに左寄せ (行の右側に余白を作る)。
const boardColumnStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  gap: '0.4rem',
  width: 'fit-content',
  alignSelf: 'flex-start',
};
const boardRangesRowStyle: CSSProperties = { display: 'flex', alignItems: 'stretch' };
const boardGroupStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.35rem' };
const slotsRowStyle: CSSProperties = { display: 'flex', gap: '0.3rem', alignItems: 'flex-start' };
const boardCellStyle: CSSProperties = {
  width: 54,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.3rem',
};
// フロップ群とターンリバー群の区切り。カード拡大のため余白を詰める。
const groupDividerStyle: CSSProperties = { width: 1, alignSelf: 'stretch', background: THEME.border, margin: '0 0.25rem' };
const slotDividerStyle: CSSProperties = { width: 1, alignSelf: 'stretch', background: THEME.border, margin: '0 0.1rem' };

const trashBtnStyle: CSSProperties = {
  width: 54,
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

// 行 = 名前 + 左ブロック(カード+ハンド, 固定幅) + 右ブロック(残り幅)。全幅を使う。
const playerRowStyle: CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: '0.55rem', padding: '0.5rem 0' };
const rowLabelStyle: CSSProperties = { fontSize: '0.92rem', fontWeight: 700, color: THEME.textPrimary, minWidth: 64, flexShrink: 0 };
// 左ブロック: カード2枚と [ハンド] ボタンを縦に積む (カード2枚分の固定幅)。
const cardColStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.4rem', flexShrink: 0 };
const slotsStyle: CSSProperties = { display: 'flex', gap: '0.35rem' };
// 右ブロック: 残り幅いっぱい。上から 勝率 / レンジ・リセット / バッジ / 役吹き出し。
const rightBlockStyle: CSSProperties = {
  flex: '1 1 0',
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  gap: '0.3rem',
};
const rangeBtnStyle: CSSProperties = {
  padding: '0.4rem 0.7rem',
  background: '#fff',
  color: THEME.textSecondary,
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.4rem',
  fontSize: '0.82rem',
  fontFamily: 'inherit',
  cursor: 'pointer',
  textAlign: 'center',
};
// ボード範囲ボタン: 縦長カードの群幅に収まるよう小さめ・改行なし。
const rangeBtnFullStyle: CSSProperties = {
  ...rangeBtnStyle,
  width: '100%',
  textAlign: 'center',
  fontSize: '0.74rem',
  padding: '0.3rem 0.25rem',
  whiteSpace: 'nowrap',
};
const rangeBtnActiveStyle: CSSProperties = {
  ...rangeBtnStyle,
  background: THEME.accent,
  color: '#fff',
  borderColor: THEME.accent,
  fontWeight: 700,
};
const handBtnStyle: CSSProperties = { ...rangeBtnStyle, width: '100%', textAlign: 'center' };
// 右ブロック内の レンジ/リセット を half / half (右ブロック幅で2分割)。
const rangeBtnsRowStyle: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' };
const rangeBadgeStyle: CSSProperties = { fontSize: '0.72rem', color: THEME.textSecondary, textAlign: 'right' };
const presetBubbleStyle: CSSProperties = {
  alignSelf: 'flex-end',
  fontSize: '0.72rem',
  fontWeight: 700,
  color: THEME.textPrimary,
  background: THEME.cardElevated,
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.4rem',
  padding: '0.15rem 0.4rem',
  textAlign: 'center',
};
const equityStyle: CSSProperties = {
  fontSize: '1.1rem',
  fontWeight: 800,
  color: THEME.accent,
  fontVariantNumeric: 'tabular-nums',
  textAlign: 'right',
};
const hintStyle: CSSProperties = { fontSize: '0.85rem', color: THEME.textMuted };
const infoStyle: CSSProperties = { fontSize: '0.85rem', color: THEME.textSecondary };
