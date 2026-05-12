// Flop 戦略タブのコンテナビュー (Phase 6 controlled-props 版)。
//
// state は App.tsx に lift 済 (Phase 6)。本コンポーネントは props として
// variant / chain / selectedBoardName + 各 setter callback を受け取り、
// 純粋な表示と内部ハンドラだけを担当する controlled component。
//
// Phase 6 で preflop → flop 連携 (DualRangeView の「Flop に進む」ボタン) から
// 同 state を共有して遷移できるようになる。

import { type CSSProperties } from 'react';
import { FlopActionTotalsCard } from './FlopActionTotalsCard';
import { FlopBoardInput } from './FlopBoardInput';
import { FlopBoardList } from './FlopBoardList';
import { FlopBoardSummary } from './FlopBoardSummary';
import { FlopBreadcrumb } from './FlopBreadcrumb';
import { FlopNextActionButtons } from './FlopNextActionButtons';
import { FlopVariantSelector } from './FlopVariantSelector';
import { encodeStep, hasAggressionInChain } from '../data/flopChain';
import { useFlopNode } from '../hooks/useFlopNode';
import { THEME } from '../styles/theme';
import type { FlopActor } from '../types/flop';

export interface FlopStrategyViewProps {
  variant: string;
  chain: ReadonlyArray<string>;
  selectedBoardName: string | null;
  /** Variant 切替時。App.tsx 側で chain と board 選択も reset するのが原則。 */
  onSelectVariant: (variant: string) => void;
  /** Chain 全体更新 (truncate / reset / push 全て同じ callback)。 */
  onChainChange: (chain: string[]) => void;
  /** Board 選択 (null = 解除)。 */
  onSelectBoard: (name: string | null) => void;
}

export function FlopStrategyView({
  variant,
  chain,
  selectedBoardName,
  onSelectVariant,
  onChainChange,
  onSelectBoard,
}: FlopStrategyViewProps) {
  // useFlopNode は array prop を内部で chain.join('|') して dep 化するので
  // ReadonlyArray<string> も同様に動く (TS は spread でコピー可)。
  const chainArr = chain as string[];
  const { data, loading, error } = useFlopNode(variant, chainArr);

  // selectedBoardName から対応 BoardSolution を取得 (data がある時のみ)
  const selectedBoard =
    data && selectedBoardName
      ? data.solutions.find((s) => s.name === selectedBoardName) ?? null
      : null;

  const handleTruncate = (newLength: number) => {
    onChainChange(chain.slice(0, newLength));
  };

  const handleReset = () => {
    onChainChange([]);
  };

  const handleSelectAction = (actionCode: string) => {
    if (!data) return;
    const actor = data._meta.next_actor as FlopActor;
    const after = hasAggressionInChain(chainArr);
    const step = encodeStep(actor, actionCode, after);
    onChainChange([...chain, step]);
  };

  // 表示用 totals: selected あれば action_solutions、なければ action_totals
  const displayTotals = selectedBoard
    ? selectedBoard.action_solutions
    : data?.action_totals ?? [];

  return (
    <div style={containerStyle}>
      <FlopVariantSelector variant={variant} onVariantChange={onSelectVariant} />

      <FlopBreadcrumb
        variant={variant}
        chain={chainArr}
        onTruncate={handleTruncate}
        onReset={handleReset}
      />

      <div style={mainAreaStyle}>
        {loading && <StatusLine kind="loading">Loading flop data…</StatusLine>}
        {error && (
          <StatusLine kind="error">
            Error: {error.message}
            <div style={errorHintStyle}>
              R2 fetch 失敗の可能性 — `.env.local` の `VITE_FLOP_DATA_BASE_URL` と CORS 設定を確認してください。
            </div>
          </StatusLine>
        )}
        {!loading && !error && data && (
          <>
            <FlopBoardSummary data={data} selectedBoard={selectedBoard} />
            <FlopActionTotalsCard totals={displayTotals}>
              <FlopNextActionButtons
                actions={data.game_point.available_actions}
                totals={displayTotals}
                afterAggression={hasAggressionInChain(chainArr)}
                onSelect={handleSelectAction}
                disabled={loading}
              />
            </FlopActionTotalsCard>
            <FlopBoardInput
              selectedBoard={selectedBoardName}
              onBoardSelect={onSelectBoard}
            />
            <FlopBoardList
              solutions={data.solutions}
              selectedBoard={selectedBoardName}
              onBoardSelect={onSelectBoard}
            />
          </>
        )}
        {!loading && !error && !data && <StatusLine kind="empty">No data.</StatusLine>}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Status line
// ----------------------------------------------------------------------------

function StatusLine({
  kind,
  children,
}: {
  kind: 'loading' | 'error' | 'empty';
  children: React.ReactNode;
}) {
  const color =
    kind === 'error' ? THEME.errorText :
    kind === 'loading' ? THEME.accent :
    THEME.textMuted;
  return <div style={{ ...statusLineStyle, color }}>{children}</div>;
}

// ----------------------------------------------------------------------------
// Styles
// ----------------------------------------------------------------------------

const containerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.85rem',
};

const mainAreaStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.85rem',
  minHeight: '120px',
};

const statusLineStyle: CSSProperties = {
  fontSize: '0.9rem',
  padding: '1rem',
  background: THEME.card,
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.5rem',
};

const errorHintStyle: CSSProperties = {
  fontSize: '0.78rem',
  color: THEME.textMuted,
  marginTop: '0.4rem',
};
