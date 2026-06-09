// 各レベルのルール説明セクション (TrainingRules ページに描画)。
//
// セクション構造:
//   1. 問題の例 (opener / 自分 / ハンドカード)
//   2. テーブル俯瞰図 (実際の問題画面と同じ PokerTable を流用)
//   3. どう応答する? (選択肢 disabled プレビュー)
//   4. 今回の答え (中級はビジュアルバー + 正解強調 / 初級はテキスト)
//   5. 採点ルール (中級のみ)
//   6. レンジ表 (HandRangeMatrix を流用、出題ハンドをハイライト)

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { ACTIONS, type Action } from '../../data/training/preflopIntermediate';
import { HandRangeMatrix } from './HandRangeMatrix';
import { ActionTable } from './ActionTable';
import { FlopCbReviewDetail } from './FlopCbReviewDetail';
import type { FlopCbStrat } from '../../data/training/flopIntermediateCb';
import type { HandStrategy } from '../../data/training/preflopBeginner';
import { CardSet } from '../CardSet';
import type { Rank, Suit } from '../../types/card';

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
      .then((h) => { if (!cancelled) setHands(h); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [file]);
  return hands;
}

// ---------------------------------------------------------------------------
// 公開エクスポート
// ---------------------------------------------------------------------------

export function RuleExplanation({ levelKey }: { levelKey: string }) {
  if (levelKey === 'preflop_beginner') return <BeginnerRule />;
  if (levelKey === 'preflop_intermediate') return <IntermediateRule />;
  if (levelKey === 'preflop_intermediate_ep') return <PositionalRule mode="ep" />;
  if (levelKey === 'preflop_intermediate_lp') return <PositionalRule mode="lp" />;
  if (levelKey === 'preflop_intermediate_blind') return <PositionalRule mode="blind" />;
  if (levelKey === 'flop_cb_srp' || levelKey === 'flop_cb_3bp' || levelKey === 'flop_donk_bmcb')
    return <PostflopRule />;
  return null;
}

// ---------------------------------------------------------------------------
// ポストフロップ (レンジCB / レンジドンク・BMCB)
//
// ポストフロップの本質「ボード依存性」(同じ BTN・同じレンジでも、ボードが違うだけで
// レンジ全体の戦略が全く変わる) を、2つのボード (AK3 / AA3) の BTN CB 戦略を
// 並べて比較して伝える。3モード共通でこの比較ビューを表示する。
// ※ 表示する頻度はすべて「ルール説明用の固定例」であり、実データ取得ではない。
// ---------------------------------------------------------------------------

// ルール説明で表示するアクション行 (0% も行を残すため固定リスト)。
const POSTFLOP_RULE_CHOICES: ReadonlyArray<string> = ['check', '33', '50', '75', '125'];
// ボードA: AK3 = 分極 (打たない or 大きく打つ)。固定例 (頻度 0-1)。
const BOARD_A_STRAT: FlopCbStrat = { check: 0.61, '33': 0.03, '50': 0.01, '75': 0.01, '125': 0.33 };
// ボードB: AA3 = レンジ全体で安く連打。固定例 (頻度 0-1)。
const BOARD_B_STRAT: FlopCbStrat = { check: 0.14, '33': 0.82, '50': 0.03, '75': 0.01, '125': 0 };

function PostflopRule() {
  return (
    <div>
      <SectionTitle>ボードによって戦略はガラッと変わる</SectionTitle>
      <Card>
        <p style={bodyTextStyle}>
          同じ BTN、同じレンジ。ボードが違うだけで「打つかどうか」も「どのサイズで打つか」も
          全然違います。だからポストフロップは自分のハンドではなく、
          <strong>ボードに対して、レンジ全体としてどう打つか</strong>を答えます。
        </p>
      </Card>

      <PostflopBoardExample
        title="ボードA(AK3)"
        cards={[
          { rank: 'A' as Rank, suit: 's' as Suit },
          { rank: 'K' as Rank, suit: 'h' as Suit },
          { rank: '3' as Rank, suit: 'd' as Suit },
        ]}
        tagline="分極(打たない or 大きく打つ)"
        strat={BOARD_A_STRAT}
        note="ナッツ級(2ペア以上のセット系)はオーバーベットで価値最大化。エースなしのミドルはほぼチェック。「中ぐらいのベット」は使わない。"
      />

      <PostflopBoardExample
        title="ボードB(AA3)"
        cards={[
          { rank: 'A' as Rank, suit: 's' as Suit },
          { rank: 'A' as Rank, suit: 'd' as Suit },
          { rank: '3' as Rank, suit: 'd' as Suit },
        ]}
        tagline="レンジ全体で安く連打"
        strat={BOARD_B_STRAT}
        note="A がボードに2枚=相手の AX が激減してこちらのレンジが圧倒的に強い。安く広く打って降ろすか薄い価値を取る。"
      />
    </div>
  );
}

function PostflopBoardExample({
  title,
  cards,
  tagline,
  strat,
  note,
}: {
  title: string;
  cards: ReadonlyArray<{ rank: Rank; suit: Suit }>;
  tagline: string;
  strat: FlopCbStrat;
  note: string;
}) {
  return (
    <>
      <SectionTitle>{title}</SectionTitle>
      <Card>
        <div style={boardRowStyle}>
          <CardSet cards={cards} size="md" gap={4} />
          <span style={taglineStyle}>{tagline}</span>
        </div>
        {/* 既存のフィードバック頻度バー (FlopCbReviewDetail) を流用。選択マークは出さない。 */}
        <FlopCbReviewDetail choices={POSTFLOP_RULE_CHOICES} strat={strat} selections={[]} />
        <p style={bodyTextStyle}>{note}</p>
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// ソリューション条件 (全レベル共通)
// ---------------------------------------------------------------------------

function SolutionConditions() {
  return (
    <>
      <SectionTitle>ソリューション条件</SectionTitle>
      <Card>
        <ul style={solutionListStyle}>
          <li>スタック: 100BB</li>
          <li>レーキ: 安め</li>
          <li>2.5BB open</li>
        </ul>
        <div style={solutionHintStyle}>(わからない人は考えなくて大丈夫です)</div>
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// 中級ポジション別 (EP / LP / Blind)
// ---------------------------------------------------------------------------

const POSITIONAL_INFO = {
  ep: {
    title: '中級 EP(UTG / HJ)',
    max: 20,
    rows: [
      'open 6問 … スライダー形式・境界出題',
      'vs 3bet 7問 … 複数選択・全ハンド出題',
      'vs 4bet 7問 … 複数選択・全ハンド出題',
    ],
  },
  lp: {
    title: '中級 LP(CO / BTN)',
    max: 20,
    rows: [
      'open 3問 … スライダー形式・境界出題',
      'vs open(BTN)3問 … 複数選択・境界出題',
      'vs open(CO)2問 … スライダー形式・境界出題',
      'vs 3bet 6問 … 複数選択・境界出題',
      'vs 4bet 6問 … 複数選択・境界出題',
    ],
  },
  blind: {
    title: '中級 Blind(SB / BB)',
    max: 30,
    rows: [
      'SB open / SB limp vs raise / SB vs 3bet・4bet・open',
      'BB vs open / BB vs limp / BB vs limp-raise / BB vs 4bet',
      'すべて複数選択・境界出題(全30問)',
    ],
  },
} as const;

function PositionalRule({ mode }: { mode: 'ep' | 'lp' | 'blind' }) {
  const info = POSITIONAL_INFO[mode];
  const hasSlider = mode === 'ep' || mode === 'lp';
  return (
    <div>
      <SolutionConditions />
      <SectionTitle>{info.title}・出題内訳(満点 {info.max}pt)</SectionTitle>
      <Card>
        <ul style={fourListStyle}>
          {info.rows.map((r) => (
            <li key={r} style={{ ...fourRowStyle, color: '#2C2C2A' }}>{r}</li>
          ))}
        </ul>
        <p style={mutedSmallStyle}>各問は -1/0/1/2pt。全問合計を最後に 2 で割って満点 {info.max}pt。</p>
      </Card>

      {hasSlider && (
        <>
          <SectionTitle>スライダー形式の採点</SectionTitle>
          <div style={scoringBoxStyle}>
            <p style={scoringRowStyle}><span style={bullet}>●</span>レイズ頻度を 0〜100%・10% 刻みで回答(「飛ばす」可)</p>
            <p style={scoringRowStyle}><span style={bullet}>●</span>正解が端(0%/100%):ピッタリ <span style={ptGreenStyle}>+2pt</span> / ±10% <span style={ptGreenStyle}>+1pt</span> / それ以外 <span style={ptRedStyle}>-1pt</span></p>
            <p style={scoringRowStyle}><span style={bullet}>●</span>正解が中間(10〜90%):±10% <span style={ptGreenStyle}>+2pt</span> / ±20% <span style={ptGreenStyle}>+1pt</span> / それ以外 <span style={ptRedStyle}>-1pt</span></p>
            <p style={scoringRowStyle}><span style={bullet}>●</span>飛ばす → 0pt / 時間切れ → <span style={ptRedStyle}>-1pt</span></p>
          </div>
        </>
      )}

      <SectionTitle>複数選択の採点</SectionTitle>
      <ScoringRulesBox />

      {mode === 'blind' && (
        <>
          <SectionTitle>limp 配点緩和(Blind 専用)</SectionTitle>
          <div style={scoringBoxStyle}>
            <p style={scoringRowStyle}><span style={bullet}>●</span>GTO が レイズ+リンプ 主体(fold 僅少)で、レイズ/リンプのみを選び fold を選ばなければ、本来 <span style={ptRedStyle}>-1pt</span> のケースを <span style={ptGreenStyle}>+1pt</span> に救済</p>
            <p style={scoringRowStyle}><span style={bullet}>●</span>fold を選ぶと救済なし。オールインは救済対象外</p>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 初級
// ---------------------------------------------------------------------------

function BeginnerRule() {
  const hands = useHands('hj.json');
  return (
    <div>
      <SolutionConditions />
      <SectionTitle>問題の例</SectionTitle>
      <Card>
        <LabelValue label="ポジション" value="HJ" />
        <LabelValue label="シナリオ" value="オープン(open 判定)" />
        <Divider />
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
      </Card>

      <SectionTitle>テーブル</SectionTitle>
      <Card>
        <ActionTable file="hj.json" mePosition="HJ" />
      </Card>

      <SectionTitle>どう応答する?</SectionTitle>
      <Card>
        <BinaryChoicesPreview />
      </Card>

      <SectionTitle>今回の答え</SectionTitle>
      <Card>
        <p style={bodyTextStyle}>
          今回はレイズ 100% なので「参加する」が正解。
        </p>
      </Card>

      <SectionTitle>レンジ表(HJ オープン)</SectionTitle>
      <Card>
        {hands ? (
          <HandRangeMatrix hands={hands} highlightHand="QJs" />
        ) : (
          <div style={mutedStyle}>レンジ読み込み中…</div>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 中級
// ---------------------------------------------------------------------------

function IntermediateRule() {
  const hands = useHands('hjr_bb.json');
  const q4s = hands?.['Q4s'];

  return (
    <div>
      <SolutionConditions />
      <SectionTitle>問題の例</SectionTitle>
      <Card>
        <LabelValue label="opener" value="HJ raise 2.5BB" />
        <LabelValue label="自分" value="BB" />
        <Divider />
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
      </Card>

      <SectionTitle>テーブル</SectionTitle>
      <Card>
        <ActionTable file="hjr_bb.json" mePosition="BB" />
      </Card>

      <SectionTitle>どう応答する?</SectionTitle>
      <Card>
        <FourChoicesPreview />
      </Card>

      <SectionTitle>今回の答え</SectionTitle>
      <Card>
        {q4s ? (
          <StrategyAnswer strategy={q4s} />
        ) : (
          <div style={mutedStyle}>戦略読み込み中…</div>
        )}
      </Card>

      <SectionTitle>採点ルール</SectionTitle>
      <ScoringRulesBox />

      <SectionTitle>レンジ表(BB vs HJ open)</SectionTitle>
      <Card>
        {hands ? (
          <HandRangeMatrix hands={hands} highlightHand="Q4s" />
        ) : (
          <div style={mutedStyle}>レンジ読み込み中…</div>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 共通パーツ
// ---------------------------------------------------------------------------

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 style={sectionTitleStyle}>{children}</h2>;
}

function Card({ children }: { children: ReactNode }) {
  return <div style={cardStyle}>{children}</div>;
}

function LabelValue({ label, value }: { label: string; value: string }) {
  return (
    <div style={labelValueRowStyle}>
      <div style={labelStyle}>{label}</div>
      <div style={valueStyle}>{value}</div>
    </div>
  );
}

function Divider() {
  return <div style={dividerStyle} />;
}

// ---------------------------------------------------------------------------
// 初級: 2択 disabled プレビュー
// ---------------------------------------------------------------------------

function BinaryChoicesPreview() {
  return (
    <div style={binaryRowStyle}>
      <button type="button" disabled style={binaryJoinStyle}>参加する</button>
      <button type="button" disabled style={binaryFoldStyle}>参加しない</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 中級: 4 アクション disabled プレビュー
// ---------------------------------------------------------------------------

const ACTION_LABEL_JA: Record<Action, string> = {
  allin: 'オールイン',
  raise: 'レイズ',
  call: 'コール',
  fold: 'フォールド',
};

const ACTION_BORDER_LIGHT: Record<Action, string> = {
  allin: '#CECBF6',
  raise: '#F7C1C1',
  call: '#C0DD97',
  fold: '#B5D4F4',
};

const ACTION_BASE: Record<Action, string> = {
  allin: '#993C9D',
  raise: '#E24B4A',
  call: '#639922',
  fold: '#378ADD',
};

function FourChoicesPreview() {
  return (
    <ul style={fourListStyle}>
      {ACTIONS.map((a) => (
        <li
          key={a}
          style={{
            ...fourRowStyle,
            border: `1.5px solid ${ACTION_BORDER_LIGHT[a]}`,
          }}
        >
          <span style={{ ...checkboxStyle, color: ACTION_BORDER_LIGHT[a] }} aria-hidden>☐</span>
          <span>{ACTION_LABEL_JA[a]}</span>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// 中級: ビジュアルバー + 戦略リスト + 正解ボックス
// ---------------------------------------------------------------------------

const MAJOR_THRESHOLD = 20;

function StrategyAnswer({ strategy }: { strategy: HandStrategy }) {
  const total =
    (strategy.allin ?? 0) +
    (strategy.raise ?? 0) +
    (strategy.call ?? 0) +
    (strategy.fold ?? 0);

  return (
    <div style={strategyAnswerStyle}>
      <div style={mutedSmallStyle}>GTO 戦略(頻度)</div>
      <StrategyBar strategy={strategy} total={total} />
      <ul style={strategyListStyle}>
        {ACTIONS.map((a) => {
          const freq = strategy[a] ?? 0;
          const isMajor = freq >= MAJOR_THRESHOLD;
          return (
            <li key={a} style={strategyListRowStyle}>
              <span style={{ ...dotStyle, background: ACTION_BASE[a] }} aria-hidden />
              <span style={isMajor ? strategyNameBoldStyle : strategyNameStyle}>
                {ACTION_LABEL_JA[a]}
              </span>
              <span style={isMajor ? strategyPctBoldStyle : strategyPctStyle}>
                {formatPct(freq)}
              </span>
            </li>
          );
        })}
      </ul>
      <AnswerPills strategy={strategy} />
    </div>
  );
}

function StrategyBar({ strategy, total }: { strategy: HandStrategy; total: number }) {
  if (total <= 0) return null;
  const segments: Array<{ key: Action; freq: number; color: string }> = [
    { key: 'allin', freq: strategy.allin ?? 0, color: '#7F77DD' },
    { key: 'raise', freq: strategy.raise ?? 0, color: '#E24B4A' },
    { key: 'call', freq: strategy.call ?? 0, color: '#639922' },
    { key: 'fold', freq: strategy.fold ?? 0, color: '#ffffff' },
  ];
  return (
    <div style={barOuterStyle} aria-label="戦略の頻度バー">
      {segments.map((seg) => {
        if (seg.freq <= 0) return null;
        const pct = (seg.freq / total) * 100;
        return (
          <div
            key={seg.key}
            style={{
              ...barSegmentStyle,
              width: `${pct}%`,
              background: seg.color,
              color: seg.key === 'fold' ? '#5F5E5A' : '#fff',
              borderLeft: seg.key === 'fold' ? '1px solid #D3D1C7' : 'none',
            }}
          >
            {pct >= 10 ? `${Math.round(seg.freq)}%` : ''}
          </div>
        );
      })}
    </div>
  );
}

function AnswerPills({ strategy }: { strategy: HandStrategy }) {
  const majors = ACTIONS.filter((a) => (strategy[a] ?? 0) >= MAJOR_THRESHOLD);
  return (
    <div style={answerBoxStyle}>
      <div style={answerLeadStyle}>正解 = 主要戦略(20%以上)を全部</div>
      <div style={pillRowStyle}>
        {majors.map((a) => (
          <span key={a} style={pillSelectedStyle}>{ACTION_LABEL_JA[a]}</span>
        ))}
        {ACTIONS.filter((a) => !majors.includes(a)).map((a) => (
          <span key={a} style={pillUnselectedStyle}>{ACTION_LABEL_JA[a]}</span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 採点ルール (中級専用)
// ---------------------------------------------------------------------------

function ScoringRulesBox() {
  return (
    <div style={scoringBoxStyle}>
      <p style={scoringRowStyle}>
        <span style={bullet}>●</span>
        主要戦略(20%以上)を選ぶ →{' '}
        <span style={ptGreenStyle}>+pt</span>(頻度に応じて段階的)
      </p>
      <p style={scoringRowStyle}>
        <span style={bullet}>●</span>
        5%未満の頻度を選ぶ →{' '}
        <span style={ptRedStyle}>-1pt</span>(即ペナルティ)
      </p>
      <p style={scoringRowStyle}>
        <span style={bullet}>●</span>
        70%以上のアクションを選ばない →{' '}
        <span style={ptRedStyle}>-1pt</span>
      </p>
      <p style={scoringRowStyle}>
        <span style={bullet}>●</span>
        時間切れ → <span style={ptRedStyle}>-1pt</span>
      </p>
      <div style={scoringDividerStyle} />
      <p style={scoringExampleStyle}>
        例: Q4s でレイズ(0%)を選ぶと <span style={ptRedStyle}>-1pt</span>
      </p>
      <p style={scoringExampleStyle}>
        合計がマイナスでも、獲得 pt は 0pt(マイナスにはなりません)
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// utils
// ---------------------------------------------------------------------------

function formatPct(pct: number): string {
  if (Math.abs(pct - Math.round(pct)) < 0.01) return `${Math.round(pct)}%`;
  return `${pct.toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const sectionTitleStyle: CSSProperties = {
  fontSize: '13px',
  fontWeight: 500,
  color: '#993C1D',
  margin: '16px 0 8px',
  padding: '0 0 0 8px',
  borderLeft: '3px solid #993C1D',
};

const cardStyle: CSSProperties = {
  background: '#ffffff',
  border: '0.5px solid #D3D1C7',
  borderRadius: '8px',
  padding: '12px',
  marginBottom: '8px',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
};

const labelValueRowStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
};
const labelStyle: CSSProperties = {
  fontSize: '11px',
  color: '#5F5E5A',
};
const valueStyle: CSSProperties = {
  fontSize: '14px',
  fontWeight: 700,
  color: '#2C2C2A',
};

const dividerStyle: CSSProperties = {
  height: 1,
  background: '#D3D1C7',
  margin: '4px 0',
};

const handBoxStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  padding: '4px 0',
};

const bodyTextStyle: CSSProperties = {
  margin: 0,
  fontSize: '14px',
  color: '#2C2C2A',
};

const mutedStyle: CSSProperties = {
  fontSize: '12px',
  color: '#8c7d6a',
};

const solutionListStyle: CSSProperties = {
  margin: 0,
  paddingLeft: '1.1rem',
  color: '#2C2C2A',
  fontSize: '14px',
  lineHeight: 1.6,
};

const solutionHintStyle: CSSProperties = {
  marginTop: '4px',
  fontSize: '12px',
  color: '#8c7d6a',
};

const mutedSmallStyle: CSSProperties = {
  fontSize: '11px',
  color: '#5F5E5A',
};

// 初級 2 択 preview
const binaryRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '8px',
};
const binaryBase: CSSProperties = {
  padding: '12px 8px',
  borderRadius: '6px',
  fontSize: '14px',
  fontWeight: 700,
  border: 'none',
  cursor: 'not-allowed',
  fontFamily: 'inherit',
};
const binaryJoinStyle: CSSProperties = {
  ...binaryBase,
  background: '#FDE6CC',
  color: '#993C1D',
};
const binaryFoldStyle: CSSProperties = {
  ...binaryBase,
  background: '#ffffff',
  color: '#2C2C2A',
  border: '1.5px solid #D3D1C7',
};

// 中級 4 択 preview
const fourListStyle: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
};
const fourRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '8px 12px',
  borderRadius: '6px',
  fontSize: '14px',
  color: '#5F5E5A',
  background: '#ffffff',
};
const checkboxStyle: CSSProperties = {
  fontSize: '16px',
  minWidth: '1rem',
};

// 戦略バー + リスト + 正解ピル
const strategyAnswerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
};
const barOuterStyle: CSSProperties = {
  display: 'flex',
  width: '100%',
  height: '24px',
  borderRadius: '4px',
  overflow: 'hidden',
  border: '1px solid #D3D1C7',
};
const barSegmentStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '11px',
  fontWeight: 700,
};
const strategyListStyle: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '3px',
};
const strategyListRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '14px 1fr auto',
  alignItems: 'center',
  gap: '8px',
  fontSize: '13px',
  color: '#2C2C2A',
};
const dotStyle: CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: '50%',
  display: 'inline-block',
};
const strategyNameStyle: CSSProperties = {
  fontWeight: 400,
};
const strategyNameBoldStyle: CSSProperties = {
  fontWeight: 700,
};
const strategyPctStyle: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  fontWeight: 400,
};
const strategyPctBoldStyle: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  fontWeight: 700,
};

// 正解ボックス
const answerBoxStyle: CSSProperties = {
  background: '#EAF3DE',
  borderLeft: '3px solid #3B6D11',
  padding: '10px 12px',
  borderRadius: '6px',
  marginTop: '6px',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
};
const answerLeadStyle: CSSProperties = {
  fontSize: '12px',
  color: '#3B6D11',
  fontWeight: 700,
};
const pillRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px',
};
const pillBase: CSSProperties = {
  padding: '3px 10px',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: 700,
};
const pillSelectedStyle: CSSProperties = {
  ...pillBase,
  background: '#3B6D11',
  color: '#ffffff',
};
const pillUnselectedStyle: CSSProperties = {
  ...pillBase,
  background: '#ffffff',
  color: '#5F5E5A',
  border: '1px solid #D3D1C7',
};

// 採点ルール
const scoringBoxStyle: CSSProperties = {
  background: '#FAEEDA',
  borderLeft: '3px solid #BA7517',
  padding: '10px 12px',
  borderRadius: '6px',
  fontSize: '12px',
  color: '#2C2C2A',
  marginBottom: '8px',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
};
const scoringRowStyle: CSSProperties = {
  margin: 0,
  display: 'flex',
  alignItems: 'baseline',
  gap: '6px',
  flexWrap: 'wrap',
};
const bullet: CSSProperties = {
  color: '#BA7517',
  fontSize: '10px',
};
const scoringDividerStyle: CSSProperties = {
  borderTop: '1px dashed #BA7517',
};
const scoringExampleStyle: CSSProperties = {
  margin: 0,
};
const ptGreenStyle: CSSProperties = {
  color: '#3B6D11',
  fontWeight: 700,
};
const ptRedStyle: CSSProperties = {
  color: '#A32D2D',
  fontWeight: 700,
};

// ポストフロップ ルール説明 (ボード比較ビュー)
const boardRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  flexWrap: 'wrap',
  marginBottom: '8px',
};
const taglineStyle: CSSProperties = {
  fontSize: '12px',
  fontWeight: 700,
  color: '#993C1D',
  background: '#FAEEDA',
  border: '1px solid #E5A551',
  borderRadius: '999px',
  padding: '0.15rem 0.6rem',
};
