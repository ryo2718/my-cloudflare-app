// Flop 戦略タブのコンテナビュー (Phase R2: 新 state model)。
//
// 元要件の 7 セクション構成:
//   § 1: FLOP 入力 (FlopBoardInput, 常時表示)
//   § 2: Position 選択 (FlopPositionPicker)
//   § 3: Preflop シナリオ (FlopPreflopPicker)
//   § 4-7: variant 決定後 (positions + bucket → variant) に表示
//          R3-R4 で再設計、R2 では既存 §4-7 を仮で利用
//
// state (props 経由、App.tsx で lift):
//   - positions: Position[]   (0-2)
//   - bucket:    PreflopBucket | null
//   - chain:     string[]      (確定 chain)
//   - selectedBoardName: string | null
//
// variant は positions + bucket から derive (findFlopVariantFromUI)。

import { useMemo, type CSSProperties } from 'react';
import { FlopBoardInput } from './FlopBoardInput';
import { FlopBoardList } from './FlopBoardList';
import { FlopBoardSummary } from './FlopBoardSummary';
import { FlopBreadcrumb } from './FlopBreadcrumb';
import { FlopOOPActions } from './FlopOOPActions';
import { FlopPositionPicker } from './FlopPositionPicker';
import { FlopPreflopPicker } from './FlopPreflopPicker';
import { encodeStep, hasAggressionInChain } from '../data/flopChain';
import { findFlopVariantFromUI, type PreflopBucket } from '../data/flopVariants';
import { useFlopNode } from '../hooks/useFlopNode';
import { THEME } from '../styles/theme';
import type { FlopActor } from '../types/flop';
import type { Position } from '../types/strategy';

export interface FlopStrategyViewProps {
  positions: ReadonlyArray<Position>;
  bucket: PreflopBucket | null;
  chain: ReadonlyArray<string>;
  selectedBoardName: string | null;
  onPositionsChange: (positions: Position[]) => void;
  onBucketChange: (bucket: PreflopBucket | null) => void;
  onChainChange: (chain: string[]) => void;
  onSelectBoard: (name: string | null) => void;
}

export function FlopStrategyView({
  positions,
  bucket,
  chain,
  selectedBoardName,
  onPositionsChange,
  onBucketChange,
  onChainChange,
  onSelectBoard,
}: FlopStrategyViewProps) {
  // variant を derive (positions + bucket → variant)
  const variant = useMemo(() => {
    if (positions.length < 2 || !bucket) return null;
    return findFlopVariantFromUI(positions as [Position, Position], bucket);
  }, [positions, bucket]);

  const chainArr = chain as string[];
  const { data, loading, error } = useFlopNode(variant, chainArr);

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

  const displayTotals = selectedBoard
    ? selectedBoard.action_solutions
    : data?.action_totals ?? [];

  return (
    <div style={containerStyle}>
      {/* § 1: Flop 入力 (常時表示) */}
      <FlopBoardInput
        selectedBoard={selectedBoardName}
        onBoardSelect={onSelectBoard}
      />

      {/* § 2: Position 選択 */}
      <FlopPositionPicker positions={positions} onChange={onPositionsChange} />

      {/* § 3: Preflop シナリオ */}
      <FlopPreflopPicker
        bucket={bucket}
        positions={positions}
        onChange={onBucketChange}
      />

      {/* § 4-7: variant 決定後 (R3-R4 で再設計予定の既存 components を仮利用) */}
      {variant === null ? (
        <div style={pendingStyle}>
          Position と Preflop シナリオを選択すると戦略が表示されます
        </div>
      ) : (
        <>
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
            {!loading && !error && data && variant && (
              <>
                <FlopBoardSummary
                  variant={variant}
                  data={data}
                  selectedBoard={selectedBoard}
                />
                {(() => {
                  // 現ノードの actor (= OOP / IP) を判定。chain 偶数 → OOP、奇数 → IP の
                  // 厳密交代 (flop_tree の制約)。data.players の relative_position と
                  // _meta.next_actor 一致でも判定可。
                  const oopPlayer = data.players.find((p) => p.relative_position === 'OOP');
                  const ipPlayer  = data.players.find((p) => p.relative_position === 'IP');
                  const nextActorLc = data._meta.next_actor;
                  const isOopTurn = oopPlayer && oopPlayer.position.toLowerCase() === nextActorLc;
                  const currentPlayer = isOopTurn ? oopPlayer : ipPlayer;
                  if (!currentPlayer) return null;
                  return (
                    <FlopOOPActions
                      actor={isOopTurn ? 'OOP' : 'IP'}
                      position={currentPlayer.position}
                      actions={data.game_point.available_actions}
                      totals={displayTotals}
                      afterAggression={hasAggressionInChain(chainArr)}
                      onSelect={handleSelectAction}
                      disabled={loading}
                    />
                  );
                })()}
                <FlopBoardList
                  solutions={data.solutions}
                  selectedBoard={selectedBoardName}
                  onBoardSelect={onSelectBoard}
                />
              </>
            )}
            {!loading && !error && !data && <StatusLine kind="empty">No data.</StatusLine>}
          </div>
        </>
      )}
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

const pendingStyle: CSSProperties = {
  background: THEME.card,
  border: `1px dashed ${THEME.border}`,
  borderRadius: '0.5rem',
  padding: '1.5rem',
  textAlign: 'center',
  fontSize: '0.85rem',
  color: THEME.textMuted,
  fontStyle: 'italic',
};
