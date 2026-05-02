import { useCallback, useEffect, useMemo, useState } from 'react';
import { Breadcrumb, type BreadcrumbItem } from './components/Breadcrumb';
import { DualRangeView } from './components/DualRangeView';
import { EvRankDisplay } from './components/EvRankDisplay';
import { HandInput } from './components/HandInput';
import { MobileApp } from './components/mobile/MobileApp';
import { OpenStrategyTable } from './components/OpenStrategyTable';
import { ScenarioSelector } from './components/ScenarioSelector';
import { FourbetStrategyTable } from './components/FourbetStrategyTable';
import { ThreebetStrategyTable } from './components/ThreebetStrategyTable';
import {
  computeAllinNodePath,
  computeRaisedNodePath,
  getNodeScenario,
  getValidResponders,
  initialLeftNodePath,
  initialRightNodePath,
  isAvailableNodePath,
  labelForNodePath,
  type OpenerPosition,
} from './data/scenarios';
import { loadAllOpenNodes } from './hooks/useOpenEvaluation';
import { loadAll3betNodes } from './hooks/use3betEvaluation';
import { loadAll4betNodes } from './hooks/use4betEvaluation';
import { useViewportMode } from './hooks/useViewportMode';
import { useStrategy } from './hooks/useStrategy';
import { THEME } from './styles/theme';
import type { Hand, Position } from './types/strategy';

const INITIAL_OPENER: OpenerPosition = 'UTG';
const INITIAL_RESPONDER: Position = 'BB';

interface BreadcrumbEntry {
  label: string;
  leftPath: string;
  rightPath: string;
}

/**
 * 初期 breadcrumb: 現在の opener/responder ペアでの「opener open」エントリを seed する。
 * 右ペイン (vs RFI ノード) の action_history から opener の open アクションを導出。
 * 例: opener=UTG, responder=BB → [{ label: "UTG open (2.5bb)", leftPath: "utg", rightPath: "utgr_bb" }]
 */
function buildInitialBreadcrumb(op: OpenerPosition, resp: Position): BreadcrumbEntry[] {
  const leftPath = initialLeftNodePath(op);
  const rightPath = initialRightNodePath(op, resp);
  const label = labelForNodePath(rightPath);
  return label ? [{ label, leftPath, rightPath }] : [];
}

export default function App() {
  // App 起動時に Open レンジ (5ファイル) と 3bet ノード (15ファイル) をバックグラウンドプリロード。
  // 合計 ~340KB / 20ファイル並列 fetch なので localhost 数十ms / 公開先でも 1-2秒程度。
  // 失敗しても各 hook 側で再 fetch するので silent で OK。
  useEffect(() => {
    loadAllOpenNodes().catch(() => { /* silent */ });
    loadAll3betNodes().catch(() => { /* silent */ });
    loadAll4betNodes().catch(() => { /* silent */ });
  }, []);

  // PC / Mobile レイアウトの切替 (Phase 1)
  const { mode: viewportMode, toggle: toggleViewport } = useViewportMode();

  const [opener, setOpener] = useState<OpenerPosition>(INITIAL_OPENER);
  const [responder, setResponder] = useState<Position>(INITIAL_RESPONDER);
  const [leftNodePath, setLeftNodePath] = useState<string>(
    initialLeftNodePath(INITIAL_OPENER),
  );
  const [rightNodePath, setRightNodePath] = useState<string>(
    initialRightNodePath(INITIAL_OPENER, INITIAL_RESPONDER),
  );
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbEntry[]>(() =>
    buildInitialBreadcrumb(INITIAL_OPENER, INITIAL_RESPONDER),
  );

  const resetToOpenerResponder = useCallback(
    (op: OpenerPosition, resp: Position) => {
      setLeftNodePath(initialLeftNodePath(op));
      setRightNodePath(initialRightNodePath(op, resp));
      setBreadcrumb(buildInitialBreadcrumb(op, resp));
    },
    [],
  );

  const handleOpenerChange = (newOpener: OpenerPosition) => {
    setOpener(newOpener);
    const valid = getValidResponders(newOpener);
    const newResp = valid.includes(responder) ? responder : valid[0];
    if (newResp !== responder) setResponder(newResp);
    resetToOpenerResponder(newOpener, newResp);
  };

  const handleResponderChange = (newResponder: Position) => {
    setResponder(newResponder);
    resetToOpenerResponder(opener, newResponder);
  };

  const leftScenario = useMemo(() => getNodeScenario(leftNodePath), [leftNodePath]);
  const rightScenario = useMemo(() => getNodeScenario(rightNodePath), [rightNodePath]);

  const left = useStrategy(leftScenario);
  const right = useStrategy(rightScenario);

  // 共通遷移ロジック: 押した側はそのまま、相手側を「押した側がXした応答」に進める。
  // 新相手 path = 押した側の現 path + suffix + 相手の hero (相手 hero は遷移後も変わらない)。
  // ラベルは遷移先パスの NODE_META から導出 (例: "BB 3bet (12bb)") — fallback あり。
  const transition = useCallback(
    (
      side: 'left' | 'right',
      computeNewPath: (clickedPath: string, opponentHero: Position) => string,
      fallbackVerb: string,
    ) => {
      const clickedPath = side === 'left' ? leftNodePath : rightNodePath;
      const opponentData = side === 'left' ? right.data : left.data;
      const clickedData = side === 'left' ? left.data : right.data;
      const opponentHero = opponentData?.metadata.hero_position;
      const clickedHero = clickedData?.metadata.hero_position;
      if (!opponentHero || !clickedHero) return;

      const newOppositePath = computeNewPath(clickedPath, opponentHero);
      const opponentCurrentPath = side === 'left' ? rightNodePath : leftNodePath;
      if (!isAvailableNodePath(newOppositePath)) return;
      if (newOppositePath === opponentCurrentPath) return; // no-op

      const newLeftPath = side === 'left' ? leftNodePath : newOppositePath;
      const newRightPath = side === 'left' ? newOppositePath : rightNodePath;

      if (side === 'left') setRightNodePath(newOppositePath);
      else setLeftNodePath(newOppositePath);

      const label = labelForNodePath(newOppositePath) ?? `${clickedHero} ${fallbackVerb}`;
      setBreadcrumb((prev) => [
        ...prev,
        { label, leftPath: newLeftPath, rightPath: newRightPath },
      ]);
    },
    [leftNodePath, rightNodePath, left.data, right.data],
  );

  const handleRaise = useCallback(
    (side: 'left' | 'right') => transition(side, computeRaisedNodePath, 'raise'),
    [transition],
  );

  const handleAllin = useCallback(
    (side: 'left' | 'right') => transition(side, computeAllinNodePath, 'all-in'),
    [transition],
  );

  // Breadcrumb: index === -1 で Home (完全リセット)、それ以上で当該ノードに巻き戻し。
  const handleBreadcrumbNavigate = useCallback(
    (index: number) => {
      if (index < 0) {
        resetToOpenerResponder(opener, responder);
        return;
      }
      const entry = breadcrumb[index];
      if (!entry) return;
      setLeftNodePath(entry.leftPath);
      setRightNodePath(entry.rightPath);
      setBreadcrumb(breadcrumb.slice(0, index + 1));
    },
    [breadcrumb, opener, responder, resetToOpenerResponder],
  );

  // 遷移ボタン enable 判定 (Raise / All-in 共通):
  //  (1) 相手のデータが読込済 (相手 hero が確定),
  //  (2) 遷移先 path が manifest 内に存在,
  //  (3) 遷移後の相手 path が現状と同じ no-op でない (常に「深い側」が動く形に自動収束)。
  const computeTransitionEnabled = (
    side: 'left' | 'right',
    computeNewPath: (clickedPath: string, opponentHero: Position) => string,
  ): boolean => {
    const clickedPath = side === 'left' ? leftNodePath : rightNodePath;
    const opponentCurrentPath = side === 'left' ? rightNodePath : leftNodePath;
    const opponentHero =
      side === 'left' ? right.data?.metadata.hero_position : left.data?.metadata.hero_position;
    if (!opponentHero) return false;
    const target = computeNewPath(clickedPath, opponentHero);
    return isAvailableNodePath(target) && target !== opponentCurrentPath;
  };

  const leftRaiseEnabled  = computeTransitionEnabled('left',  computeRaisedNodePath);
  const rightRaiseEnabled = computeTransitionEnabled('right', computeRaisedNodePath);
  const leftAllinEnabled  = computeTransitionEnabled('left',  computeAllinNodePath);
  const rightAllinEnabled = computeTransitionEnabled('right', computeAllinNodePath);

  const breadcrumbItems: BreadcrumbItem[] = breadcrumb.map((b) => ({ label: b.label }));

  // RFI subtitle "Open X%" は、左ペインが opener 自身の RFI ノード (= 初期状態) のときのみ表示。
  // 新仕様で初期 breadcrumb は常に "opener open" を含むため、breadcrumb.length では判定できない。
  const isAtRfiRoot = leftNodePath === initialLeftNodePath(opener);
  const rfiSubtitle =
    left.data?.metadata.open_rate_pct !== undefined && isAtRfiRoot
      ? `Open ${left.data.metadata.open_rate_pct.toFixed(1)}%`
      : undefined;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: THEME.bg,
        color: THEME.textPrimary,
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
        padding: '1.5rem',
      }}
    >
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <header style={{ marginBottom: '1.25rem', position: 'relative' }}>
          <div
            style={{
              fontSize: '0.7rem',
              color: THEME.textMuted,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              marginBottom: '0.2rem',
            }}
          >
            Preflop Strategy Viewer
          </div>
          {/* h1 副題 + 仕様 1行 はモバイル時に隠す (eyebrow "Preflop Strategy Viewer" のみ表示) */}
          {viewportMode === 'pc' && (
            <>
              <h1
                style={{
                  margin: 0,
                  fontSize: '1.6rem',
                  fontWeight: 700,
                  color: THEME.textPrimary,
                }}
              >
                Open Range × Response
              </h1>
              <div style={{ fontSize: '0.78rem', color: THEME.textSecondary, marginTop: '0.2rem' }}>
                6max · 100bb · 2 ranges side by side
              </div>
            </>
          )}
          {/* レイアウト切替ボタン: 現在の表示と「逆」のラベルを出す */}
          <button
            type="button"
            onClick={toggleViewport}
            title="PC版/モバイル版を切替"
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              background: 'transparent',
              border: '1px solid #b8a888',
              borderRadius: '4px',
              padding: '4px 10px',
              fontSize: '11px',
              color: '#6b5a48',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {viewportMode === 'pc' ? 'モバイル版' : 'PC版'}
          </button>
        </header>

        {viewportMode === 'mobile' ? (
          <MobileApp />
        ) : (
        <>
        <div style={{ marginBottom: '0.9rem' }}>
          <ScenarioSelector
            opener={opener}
            responder={responder}
            onOpenerChange={handleOpenerChange}
            onResponderChange={handleResponderChange}
          />
        </div>

        {breadcrumb.length > 0 && (
          <div style={{ marginBottom: '0.9rem' }}>
            <Breadcrumb items={breadcrumbItems} onNavigate={handleBreadcrumbNavigate} />
          </div>
        )}

        <DualRangeView
          left={{
            data: left.data,
            loading: left.loading,
            error: left.error,
            title: leftPaneTitle(left.data?.metadata.hero_position ?? opener, leftNodePath),
            subtitle: rfiSubtitle,
            raiseEnabled: leftRaiseEnabled,
            onRaise: () => handleRaise('left'),
            allinEnabled: leftAllinEnabled,
            onAllin: () => handleAllin('left'),
          }}
          right={{
            data: right.data,
            loading: right.loading,
            error: right.error,
            title: rightPaneTitle(
              right.data?.metadata.hero_position ?? responder,
              left.data?.metadata.hero_position ?? opener,
            ),
            subtitle: right.data?.metadata.scenario_name,
            raiseEnabled: rightRaiseEnabled,
            onRaise: () => handleRaise('right'),
            allinEnabled: rightAllinEnabled,
            onAllin: () => handleAllin('right'),
          }}
        />

        {/* TEMP: Hand Evaluator 試作エリア。用途確定後に専用ページ/モーダルへ移動して削除予定。 */}
        <OpenStrategyTestArea />

        <footer
          style={{
            marginTop: '1.5rem',
            fontSize: '0.7rem',
            color: THEME.textFaint,
            textAlign: 'center',
          }}
        >
          Schema v{left.data?.schema_version ?? '—'} · GTO Wizard data
        </footer>
        </>
        )}
      </div>
    </div>
  );
}

function OpenStrategyTestArea() {
  const [hand, setHand] = useState<Hand | null>(null);
  return (
    <details
      style={{
        marginTop: '1.5rem',
        background: THEME.card,
        border: `1px solid ${THEME.border}`,
        borderRadius: '0.5rem',
        padding: '0.75rem',
      }}
    >
      <summary
        style={{
          cursor: 'pointer',
          color: THEME.textSecondary,
          fontSize: '0.78rem',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          userSelect: 'none',
        }}
      >
        Hand Evaluator (Open 戦略 — 試作エリア)
      </summary>
      <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* 上段: HandInput (左) と EvRankDisplay (右) の2カラム。
            <=768px では index.css のメディアクエリで縦並びに切替。 */}
        <div
          className="hand-evaluator-top-row"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(320px, 1fr) minmax(0, 1fr)',
            gap: '1rem',
            alignItems: 'stretch',
          }}
        >
          <HandInput onChange={(notation) => setHand(notation as Hand | null)} />
          <EvRankDisplay hand={hand} />
        </div>
        {/* 下段1: Open戦略 (フル幅) */}
        <OpenStrategyTable hand={hand} />
        {/* 下段2: 3bet戦略 (vs ポジション別タブ、フル幅) */}
        <ThreebetStrategyTable hand={hand} />
        {/* 下段3: 4bet戦略 (vs ポジション別タブ、フル幅) */}
        <FourbetStrategyTable hand={hand} />
      </div>
    </details>
  );
}

function leftPaneTitle(hero: Position, leftPath: string): string {
  // ノードの深さ = path のセグメント数 (utg=1, utgr_bbr_utg=3, utgr_bbr_utgr_bbr_utg=5, ...)
  const step = leftPath.split('_').length;
  return step === 1 ? `${hero} Open` : `${hero} (step ${step})`;
}

function rightPaneTitle(hero: Position, opener: Position): string {
  return `${hero} vs ${opener}`;
}
