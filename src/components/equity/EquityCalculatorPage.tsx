// /equity: エクイティ計算 (フェーズ1)。
//   - ストリートタブ (プリフロップのみ実装、他は準備中)
//   - Player A / B の 2 人固定。各 2 枚のカードスロット + レンジ(未実装) + リセット
//   - 4 枚揃うと自動で全列挙エクイティを計算して勝率 % を表示
//
// フェーズ1: フロップ以降・レンジ指定・3人以上は未実装。

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
type Street = 'preflop' | 'flop' | 'turn' | 'river';

interface SelectingTarget {
  player: PlayerId;
  slot: SlotIdx;
}

const STREETS: Array<{ key: Street; label: string; implemented: boolean }> = [
  { key: 'preflop', label: 'プリフロップ', implemented: true },
  { key: 'flop', label: 'フロップ', implemented: false },
  { key: 'turn', label: 'ターン', implemented: false },
  { key: 'river', label: 'リバー', implemented: false },
];

export function EquityCalculatorPage() {
  const [street] = useState<Street>('preflop');
  const [hands, setHands] = useState<Record<PlayerId, [Card | null, Card | null]>>({
    A: [null, null],
    B: [null, null],
  });
  const [selecting, setSelecting] = useState<SelectingTarget | null>(null);
  const [result, setResult] = useState<EquityResult | null>(null);
  const [computing, setComputing] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  // 使用中カード集合 (重複防止 + 選択不可表示)。
  const usedCards = useMemo(() => {
    const set = new Set<string>();
    for (const p of ['A', 'B'] as PlayerId[]) {
      for (const c of hands[p]) if (c) set.add(cardToString(c));
    }
    return set;
  }, [hands]);

  const a0 = hands.A[0] ? cardToString(hands.A[0]!) : '';
  const a1 = hands.A[1] ? cardToString(hands.A[1]!) : '';
  const b0 = hands.B[0] ? cardToString(hands.B[0]!) : '';
  const b1 = hands.B[1] ? cardToString(hands.B[1]!) : '';
  const allSet = !!(hands.A[0] && hands.A[1] && hands.B[0] && hands.B[1]);

  // 4 枚揃ったら自動計算。重い (約170万通り) のでペイント後に setTimeout で実行。
  useEffect(() => {
    if (!allSet) {
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
      );
      setResult(r);
      setComputing(false);
    }, 30);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSet, a0, a1, b0, b1]);

  const openSelector = (player: PlayerId, slot: SlotIdx) => {
    setInfo(null);
    setSelecting({ player, slot });
  };

  const pickCard = (card: Card) => {
    if (!selecting) return;
    setHands((prev) => {
      const next = { ...prev, [selecting.player]: [...prev[selecting.player]] as [Card | null, Card | null] };
      next[selecting.player][selecting.slot] = card;
      return next;
    });
    setSelecting(null);
  };

  const resetPlayer = (player: PlayerId) => {
    setHands((prev) => ({ ...prev, [player]: [null, null] }));
  };

  // 選択中スロットの現在のカードは選び直せるよう usedCards から除外。
  const selectorUsed = useMemo(() => {
    if (!selecting) return usedCards;
    const cur = hands[selecting.player][selecting.slot];
    if (!cur) return usedCards;
    const s = new Set(usedCards);
    s.delete(cardToString(cur));
    return s;
  }, [usedCards, selecting, hands]);

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

        <div style={tabRowStyle} role="tablist" aria-label="ストリート">
          {STREETS.map((s) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={street === s.key}
              onClick={() => {
                if (!s.implemented) setInfo(`${s.label}は準備中です`);
              }}
              style={street === s.key ? tabActiveStyle : s.implemented ? tabStyle : tabDisabledStyle}
            >
              {s.label}
              {!s.implemented && <span style={soonStyle}>(未実装)</span>}
            </button>
          ))}
        </div>

        <div style={dividerStyle} />

        {(['A', 'B'] as PlayerId[]).map((p) => (
          <div key={p} style={playerRowStyle}>
            <span style={playerNameStyle}>Player {p}</span>
            <div style={slotsStyle}>
              <CardSlot
                card={hands[p][0]}
                active={selecting?.player === p && selecting.slot === 0}
                onClick={() => openSelector(p, 0)}
              />
              <CardSlot
                card={hands[p][1]}
                active={selecting?.player === p && selecting.slot === 1}
                onClick={() => openSelector(p, 1)}
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
const tabRowStyle: CSSProperties = { display: 'flex', gap: '0.35rem', flexWrap: 'wrap' };
const tabStyle: CSSProperties = {
  padding: '0.4rem 0.7rem',
  background: '#fff',
  color: THEME.textPrimary,
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.4rem',
  fontSize: '0.85rem',
  fontFamily: 'inherit',
  cursor: 'pointer',
};
const tabActiveStyle: CSSProperties = { ...tabStyle, background: THEME.accent, color: '#fff', borderColor: THEME.accent, fontWeight: 700 };
const tabDisabledStyle: CSSProperties = { ...tabStyle, color: THEME.textMuted, cursor: 'default', opacity: 0.7 };
const soonStyle: CSSProperties = { fontSize: '0.65rem', marginLeft: '0.2rem' };
const dividerStyle: CSSProperties = { height: 1, background: THEME.border };
const playerRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.55rem',
  flexWrap: 'wrap',
  padding: '0.5rem 0',
};
const playerNameStyle: CSSProperties = { fontSize: '0.92rem', fontWeight: 700, color: THEME.textPrimary, minWidth: 64 };
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
