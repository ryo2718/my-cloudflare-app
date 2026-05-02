import { useState } from 'react';
import type { StrategyData } from '../types/strategy';
import { THEME } from '../styles/theme';
import { ActionButton } from './ActionButton';
import { AggregateReport } from './AggregateReport';
import { HandDetail } from './HandDetail';
import { HandMatrix } from './HandMatrix';

export interface RangePane {
  data: StrategyData | null;
  loading: boolean;
  error: Error | null;
  title: string;
  subtitle?: string;
  /** Raise可能か (manifestに遷移先pathが存在するか) */
  raiseEnabled?: boolean;
  /** Raise押下ハンドラ */
  onRaise?: () => void;
  /** All-in可能か (manifestに遷移先pathが存在するか) */
  allinEnabled?: boolean;
  /** All-in押下ハンドラ */
  onAllin?: () => void;
}

// Action 色: src/utils/normalize.ts の FIXED_ACTIONS と揃える。
const RAISE_COLOR = '#ef4444';
const ALLIN_COLOR = '#9333ea';

interface Props {
  left: RangePane;
  right: RangePane;
}

type Side = 'left' | 'right';

interface HoverState {
  hand: string;
  side: Side;
}

export function DualRangeView({ left, right }: Props) {
  const [hover, setHover] = useState<HoverState | null>(null);

  const onPaneHover = (side: Side) => (hand: string | null) => {
    setHover(hand ? { hand, side } : null);
  };

  const detailPane = hover ? (hover.side === 'left' ? left : right) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div
        style={{
          display: 'grid',
          // 各ペインの最低 640px を要求 → ビューポートが ~1280px 未満なら自動的に縦並び
          gridTemplateColumns: 'repeat(auto-fit, minmax(640px, 1fr))',
          gap: '1rem',
          alignItems: 'start',
          justifyItems: 'center',
        }}
      >
        <PaneView
          pane={left}
          hoveredHand={hover?.side === 'left' ? hover.hand : null}
          onHover={onPaneHover('left')}
        />
        <PaneView
          pane={right}
          hoveredHand={hover?.side === 'right' ? hover.hand : null}
          onHover={onPaneHover('right')}
        />
      </div>

      <HandDetail
        hand={hover?.hand ?? null}
        strategy={detailPane?.data?.strategy ?? null}
        actions={detailPane?.data?.actions ?? []}
        sideLabel={detailPane?.title}
      />
    </div>
  );
}

interface PaneViewProps {
  pane: RangePane;
  hoveredHand: string | null;
  onHover: (hand: string | null) => void;
}

function PaneView({ pane, hoveredHand, onHover }: PaneViewProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.65rem',
        width: '100%',
        maxWidth: '520px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '0.6rem',
          flexWrap: 'wrap',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '1.05rem', color: THEME.textPrimary, fontWeight: 700 }}>
          {pane.title}
        </h2>
        {pane.subtitle && (
          <span style={{ fontSize: '0.78rem', color: THEME.textSecondary }}>{pane.subtitle}</span>
        )}
      </div>

      {pane.error && (
        <div
          style={{
            background: THEME.errorBg,
            border: `1px solid ${THEME.errorBorder}`,
            color: THEME.errorText,
            padding: '0.5rem 0.75rem',
            borderRadius: '0.375rem',
            fontSize: '0.8rem',
          }}
        >
          {pane.error.message}
        </div>
      )}

      {pane.loading && !pane.data ? (
        <div
          style={{
            padding: '2rem',
            textAlign: 'center',
            color: THEME.textMuted,
            background: THEME.card,
            borderRadius: '0.5rem',
            border: `1px solid ${THEME.border}`,
            minHeight: '20rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.875rem',
          }}
        >
          Loading…
        </div>
      ) : pane.data ? (
        <>
          <HandMatrix
            strategy={pane.data.strategy}
            actions={pane.data.actions}
            hoveredHand={hoveredHand}
            onHover={onHover}
          />
          <AggregateReport strategy={pane.data.strategy} actions={pane.data.actions} />
          <div style={{ display: 'flex', gap: '0.5rem', alignSelf: 'flex-start' }}>
            <ActionButton
              label="Raise"
              enabled={!!pane.raiseEnabled}
              onClick={pane.onRaise}
              enabledColor={RAISE_COLOR}
              enabledTitle="相手側を raise応答 のノードに進める"
              disabledTitle="このノードでは raise 遷移先が存在しません"
            />
            <ActionButton
              label="All-in"
              enabled={!!pane.allinEnabled}
              onClick={pane.onAllin}
              enabledColor={ALLIN_COLOR}
              enabledTitle="相手側を all-in応答 のノードに進める"
              disabledTitle="このノードでは all-in 遷移先が存在しません"
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
