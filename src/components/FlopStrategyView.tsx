// Flop 戦略タブのコンテナビュー (Phase R4: dual-row + tentative commit)。
//
// 元要件:
//   § 5: OOP アクション一覧 (current node の actor、tentative pick)
//   § 6: IP アクション一覧 (OOP 決定後の child node 表示、commit で chain 2 step 進む)
//   OOP click → pendingAction set → child node fetch → IP options 表示
//   IP click → commit (chain に 2 step push)、pending clear
//   OOP の取消: 同 action 再 click

import { useMemo, useState, type CSSProperties } from 'react';
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
import type { FlopActor, FlopNode } from '../types/flop';
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
  // Variant を derive (positions + bucket)
  const variant = useMemo(() => {
    if (positions.length < 2 || !bucket) return null;
    return findFlopVariantFromUI(positions as [Position, Position], bucket);
  }, [positions, bucket]);

  const chainArr = chain as string[];
  const { data: currentData, loading: currentLoading, error: currentError } =
    useFlopNode(variant, chainArr);

  // Tentative pending: 現 actor (top row) が click したが、まだ commit されてない action code。
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  // tempChain: pendingAction 適用後の chain (= child node の fetch key)。null なら fetch しない。
  const tempChain = useMemo(() => {
    if (!pendingAction || !currentData) return null;
    const actor = currentData._meta.next_actor as FlopActor;
    const after = hasAggressionInChain(chainArr);
    const step = encodeStep(actor, pendingAction, after);
    return [...chainArr, step];
  }, [pendingAction, currentData, chainArr]);

  // 子ノード fetch (pendingAction 非 null 時のみ)
  const { data: pendingData, loading: pendingLoading, error: pendingError } =
    useFlopNode(pendingAction ? variant : null, tempChain ?? []);

  const selectedBoard =
    currentData && selectedBoardName
      ? currentData.solutions.find((s) => s.name === selectedBoardName) ?? null
      : null;

  const displayTotals = selectedBoard
    ? selectedBoard.action_solutions
    : currentData?.action_totals ?? [];

  // Bottom row も top row と同じく、選択中ボードがあれば per-board solution を引く。
  // 引けなかった場合 (board name 不一致など) は変種全体の平均にフォールバック。
  const pendingSelectedBoard =
    pendingData && selectedBoardName
      ? pendingData.solutions.find((s) => s.name === selectedBoardName) ?? null
      : null;

  const pendingDisplayTotals = pendingSelectedBoard
    ? pendingSelectedBoard.action_solutions
    : pendingData?.action_totals ?? [];

  // ----- Breadcrumb handlers -----
  const handleTruncate = (newLength: number) => {
    onChainChange(chain.slice(0, newLength));
    setPendingAction(null); // chain 変更で pending 解除
  };

  const handleReset = () => {
    onChainChange([]);
    setPendingAction(null);
  };

  // ----- Top row (current actor): tentative click -----
  const handleTopSelect = (actionCode: string) => {
    if (pendingAction === actionCode) {
      setPendingAction(null); // 取消
    } else {
      setPendingAction(actionCode);
    }
  };

  // ----- Bottom row (next actor): commit -----
  const handleBottomCommit = (ipActionCode: string) => {
    if (!currentData || !pendingAction || !pendingData) return;
    const currentActor = currentData._meta.next_actor as FlopActor;
    const currentAfter = hasAggressionInChain(chainArr);
    const topStep = encodeStep(currentActor, pendingAction, currentAfter);

    const newChainAfterTop = [...chainArr, topStep];
    const nextActor = pendingData._meta.next_actor as FlopActor;
    const nextAfter = hasAggressionInChain(newChainAfterTop);
    const bottomStep = encodeStep(nextActor, ipActionCode, nextAfter);

    onChainChange([...newChainAfterTop, bottomStep]);
    setPendingAction(null);
  };

  // ----- Actor label resolution -----
  const actorLabels = useMemo(
    () => resolveActorLabels(currentData),
    [currentData],
  );
  const pendingActorLabels = useMemo(
    () => resolveActorLabels(pendingData),
    [pendingData],
  );

  return (
    <div style={containerStyle}>
      {/* § 1: Flop 入力 */}
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

      {/* § 4-7: variant 決定後 */}
      {variant === null ? (
        <div style={pendingStyle}>
          Position と Preflop シナリオを選択すると戦略が表示されます
        </div>
      ) : (
        <div style={mainAreaStyle}>
          {currentLoading && <StatusLine kind="loading">Loading flop data…</StatusLine>}
          {currentError && (
            <StatusLine kind="error">
              Error: {currentError.message}
              <div style={errorHintStyle}>
                R2 fetch 失敗の可能性 — `.env.local` の `VITE_FLOP_DATA_BASE_URL` と CORS 設定を確認してください。
              </div>
            </StatusLine>
          )}
          {!currentLoading && !currentError && currentData && actorLabels && (
            <>
              {/* § 4: Board Summary (横並び) */}
              <FlopBoardSummary
                variant={variant}
                data={currentData}
                selectedBoard={selectedBoard}
              />

              {/* § 5: 上段 (current actor) actions table、tentative click */}
              <FlopOOPActions
                actor={actorLabels.current}
                position={actorLabels.currentPos}
                actions={currentData.game_point.available_actions}
                totals={displayTotals}
                afterAggression={hasAggressionInChain(chainArr)}
                onSelect={handleTopSelect}
                pendingActionCode={pendingAction}
              />

              {/* § 6: 下段 (next actor) actions table、pending 時のみ表示 */}
              {pendingAction && (
                <>
                  {pendingLoading && <StatusLine kind="loading">Loading next node…</StatusLine>}
                  {pendingError && (
                    <StatusLine kind="error">
                      子ノード取得失敗: {pendingError.message}
                    </StatusLine>
                  )}
                  {!pendingLoading && !pendingError && pendingData && pendingActorLabels && (
                    <FlopOOPActions
                      actor={pendingActorLabels.current}
                      position={pendingActorLabels.currentPos}
                      actions={pendingData.game_point.available_actions}
                      totals={pendingDisplayTotals}
                      afterAggression={hasAggressionInChain(tempChain ?? [])}
                      onSelect={handleBottomCommit}
                      subtitle="↑ の選択を反映した次ノード"
                    />
                  )}
                </>
              )}
              {!pendingAction && (
                <div style={waitHintStyle}>
                  上の actions から 1 つクリックすると、相手 (next actor) の応答が表示されます
                </div>
              )}

              {/* § 7: 履歴 (Breadcrumb) — 最下部 */}
              <FlopBreadcrumb
                variant={variant}
                chain={chainArr}
                onTruncate={handleTruncate}
                onReset={handleReset}
              />

              {/* (任意) Board 別解 */}
              <FlopBoardList
                solutions={currentData.solutions}
                selectedBoard={selectedBoardName}
                onBoardSelect={onSelectBoard}
              />
            </>
          )}
          {!currentLoading && !currentError && !currentData && <StatusLine kind="empty">No data.</StatusLine>}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Actor label resolution
// ----------------------------------------------------------------------------

interface ActorLabels {
  current: 'OOP' | 'IP';
  currentPos: string;
}

function resolveActorLabels(data: FlopNode | null): ActorLabels | null {
  if (!data) return null;
  const oop = data.players.find((p) => p.relative_position === 'OOP');
  const ip = data.players.find((p) => p.relative_position === 'IP');
  const nextActorLc = data._meta.next_actor;
  if (oop && oop.position.toLowerCase() === nextActorLc) {
    return { current: 'OOP', currentPos: oop.position };
  }
  if (ip && ip.position.toLowerCase() === nextActorLc) {
    return { current: 'IP', currentPos: ip.position };
  }
  return null;
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

const waitHintStyle: CSSProperties = {
  fontSize: '0.78rem',
  color: THEME.textMuted,
  fontStyle: 'italic',
  padding: '0.5rem 1rem',
  background: THEME.bg,
  borderRadius: '0.4rem',
  textAlign: 'center',
};
