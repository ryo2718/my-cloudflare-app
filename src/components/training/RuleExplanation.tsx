// 各レベルのルール説明セクション (QuizPage のアコーディオン内に展開)。
//
// 初級: HJ で QJs (raise 100%) → 参加する
// 中級: BB vs HJ open で Q4s (call 24% / fold 76%) → コール + フォールド
//
// レンジ表は中級用に既に作った HandRangeMatrix を流用 (4 アクション色 + ハイライト)。

import { useEffect, useState, type CSSProperties } from 'react';
import { HandRangeMatrix } from './HandRangeMatrix';
import type { HandStrategy } from '../../data/training/preflopBeginner';
import { CardSet } from '../CardSet';
import type { Rank, Suit } from '../../types/card';
import { THEME } from '../../styles/theme';

const PREFLOP_DATA_ROOT = '/data/preflop/cash_100bb_6max_nl500_2.5x';

interface RawNode { hands: Record<string, HandStrategy> }

type HandsCache = Record<string, Record<string, HandStrategy>>;
const cache: HandsCache = {};

async function fetchHands(file: string): Promise<Record<string, HandStrategy>> {
  if (cache[file]) return cache[file];
  const res = await fetch(`${PREFLOP_DATA_ROOT}/${file}`);
  if (!res.ok) throw new Error(`failed to load ${file}: ${res.status}`);
  const raw = (await res.json()) as RawNode;
  cache[file] = raw.hands;
  return raw.hands;
}

function useHands(file: string): Record<string, HandStrategy> | null {
  const [hands, setHands] = useState<Record<string, HandStrategy> | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchHands(file)
      .then((h) => {
        if (!cancelled) setHands(h);
      })
      .catch(() => {
        // silent fallback
      });
    return () => {
      cancelled = true;
    };
  }, [file]);
  return hands;
}

// ---------------------------------------------------------------------------
// 公開エクスポート
// ---------------------------------------------------------------------------

export function RuleExplanation({ levelKey }: { levelKey: string }) {
  if (levelKey === 'preflop_beginner') return <BeginnerRule />;
  if (levelKey === 'preflop_intermediate') return <IntermediateRule />;
  return null;
}

// ---------------------------------------------------------------------------
// 初級用ルール
// ---------------------------------------------------------------------------

function BeginnerRule() {
  const hands = useHands('hj.json');
  return (
    <section style={sectionStyle} aria-label="初級ルール説明">
      <h3 style={titleStyle}>ルール説明</h3>

      <Block label="問題の例">
        <p style={lineStyle}>ポジション: HJ</p>
        <p style={lineStyle}>ハンド: Q♠ J♠</p>
        <div style={handBoxStyle}>
          <CardSet
            cards={[
              { rank: 'Q' as Rank, suit: 's' as Suit },
              { rank: 'J' as Rank, suit: 's' as Suit },
            ]}
            size="md"
            gap={4}
          />
        </div>
        <p style={lineStyle}>[参加する] [参加しない]</p>
      </Block>

      <Block label="選び方">
        <p style={lineStyle}>
          コール または レイズすることのほうが多い場合、「参加する」を選んでください。
        </p>
      </Block>

      <Block label="今回の答え">
        <p style={lineStyle}>今回はレイズ100%なので「参加する」が正解。</p>
      </Block>

      <Block label="レンジ表(HJ オープン)">
        {hands ? (
          <HandRangeMatrix hands={hands} highlightHand="QJs" />
        ) : (
          <div style={loadingStyle}>レンジ読み込み中…</div>
        )}
      </Block>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 中級用ルール
// ---------------------------------------------------------------------------

function IntermediateRule() {
  const hands = useHands('hjr_bb.json');
  const q4s = hands?.['Q4s'];

  return (
    <section style={sectionStyle} aria-label="中級ルール説明">
      <h3 style={titleStyle}>ルール説明</h3>

      <Block label="問題の例">
        <p style={lineStyle}>opener: HJ raise 2.5BB</p>
        <p style={lineStyle}>自分: BB</p>
        <p style={lineStyle}>ハンド: Q♣ 4♣</p>
        <div style={handBoxStyle}>
          <CardSet
            cards={[
              { rank: 'Q' as Rank, suit: 'c' as Suit },
              { rank: '4' as Rank, suit: 'c' as Suit },
            ]}
            size="md"
            gap={4}
          />
        </div>
        <p style={lineStyle}>どう応答する?(複数選択可)</p>
        <ul style={choiceListStyle}>
          <li>☐ オールイン</li>
          <li>☐ レイズ</li>
          <li>☐ コール</li>
          <li>☐ フォールド</li>
        </ul>
      </Block>

      <Block label="選び方">
        <p style={lineStyle}>頻度の高い戦略を選んでください。</p>
      </Block>

      <Block label="今回の答え">
        <p style={lineStyle}>GTO 戦略:</p>
        <ul style={strategyListStyle}>
          <li>オールイン: {q4s ? formatPct(q4s.allin) : '—'}</li>
          <li>レイズ: {q4s ? formatPct(q4s.raise) : '—'}</li>
          <li>コール: {q4s ? formatPct(q4s.call) : '—'}</li>
          <li>フォールド: {q4s ? formatPct(q4s.fold) : '—'}</li>
        </ul>
        <p style={lineStyle}>
          主要戦略 = 20%以上 = コール と フォールド → コール と フォールド を選ぶのが正解。
        </p>
      </Block>

      <Block label="採点ルール">
        <ul style={ruleListStyle}>
          <li>主要戦略(20%以上)を選ぶと +pt(頻度に応じて段階的)</li>
          <li>5%未満の頻度を選ぶと -1pt(即ペナルティ)</li>
          <li>例: Q4s でレイズ(0%)を選ぶと -1pt</li>
        </ul>
      </Block>

      <Block label="レンジ表(BB vs HJ open)">
        {hands ? (
          <HandRangeMatrix hands={hands} highlightHand="Q4s" />
        ) : (
          <div style={loadingStyle}>レンジ読み込み中…</div>
        )}
      </Block>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 共通ブロック / フォーマッタ
// ---------------------------------------------------------------------------

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={blockStyle}>
      <div style={blockLabelStyle}>【{label}】</div>
      <div style={blockBodyStyle}>{children}</div>
    </div>
  );
}

function formatPct(pct: number): string {
  if (Math.abs(pct - Math.round(pct)) < 0.01) return `${Math.round(pct)}%`;
  return `${pct.toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const sectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.7rem',
  marginTop: '0.6rem',
  paddingTop: '0.6rem',
  borderTop: `1px dashed ${THEME.border}`,
};
const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.95rem',
  fontWeight: 700,
  color: THEME.textPrimary,
};
const blockStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
};
const blockLabelStyle: CSSProperties = {
  fontSize: '0.8rem',
  fontWeight: 700,
  color: THEME.textSecondary,
};
const blockBodyStyle: CSSProperties = {
  fontSize: '0.85rem',
  color: THEME.textPrimary,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.3rem',
};
const lineStyle: CSSProperties = {
  margin: 0,
};
const handBoxStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  padding: '0.3rem 0',
};
const choiceListStyle: CSSProperties = {
  margin: 0,
  padding: 0,
  listStyle: 'none',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.15rem',
  color: THEME.textSecondary,
};
const strategyListStyle: CSSProperties = {
  margin: 0,
  paddingLeft: '1rem',
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  fontSize: '0.85rem',
};
const ruleListStyle: CSSProperties = {
  margin: 0,
  paddingLeft: '1.1rem',
  lineHeight: 1.55,
};
const loadingStyle: CSSProperties = {
  fontSize: '0.8rem',
  color: THEME.textMuted,
};
