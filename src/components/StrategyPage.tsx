// Strategy 画面。プリフロップは新グリッド (preflopV2 RangeView)、フロップは既存
// FlopStrategyView / MobileFlopView。全 8 コンフィグを単一ローダ/UIで扱う (Phase X3)。
// 旧 2ペイン (DualRangeView) / MobileApp preflop / scenarios / useStrategy は撤去済み。

import { type CSSProperties, useCallback, useEffect, useState } from 'react';
import { EvRankDisplay } from './EvRankDisplay';
import { HandInput } from './HandInput';
import { MobileFlopView } from './mobile/MobileFlopView';
import { OpenStrategyTable } from './OpenStrategyTable';
import { FlopStrategyView } from './FlopStrategyView';
import { ConfigSelector } from './preflopV2/ConfigSelector';
import { RangeView } from './preflopV2/RangeView';
import { FourbetStrategyTable } from './FourbetStrategyTable';
import { ThreebetStrategyTable } from './ThreebetStrategyTable';
import { TopTabs, type TopTab } from './TopTabs';
import { AppHeader } from './AppHeader';
import { type PreflopBucket } from '../data/flopVariants';
import { loadAllOpenNodes } from '../hooks/useOpenEvaluation';
import { loadAll3betNodes } from '../hooks/use3betEvaluation';
import { loadAll4betNodes } from '../hooks/use4betEvaluation';
import { useViewportMode } from '../hooks/useViewportMode';
import { useRoute } from '../router/router-core';
import { DEFAULT_CONFIG_ID, findConfig } from '../data/preflopV2/configs';
import { THEME } from '../styles/theme';
import type { Hand, Position } from '../types/strategy';

/** "/strategy/<config>/<stem>" を解析。bare /strategy はデフォルト config + root。 */
function parsePreflopRoute(path: string): { configId: string; stem: string } {
  const rest = path.replace(/^\/strategy\/?/, '');
  const segs = rest
    .split('/')
    .filter(Boolean)
    .map((s) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    });
  return { configId: segs[0] ?? DEFAULT_CONFIG_ID, stem: segs[1] ?? 'root' };
}

export function StrategyPage() {
  // Hand Evaluator (OpenStrategyTestArea) 用に Open/3bet/4bet データをバックグラウンド preload。
  useEffect(() => {
    loadAllOpenNodes().catch(() => { /* silent */ });
    loadAll3betNodes().catch(() => { /* silent */ });
    loadAll4betNodes().catch(() => { /* silent */ });
  }, []);

  const { mode: viewportMode, toggle: toggleViewport } = useViewportMode();
  const [activeTab, setActiveTab] = useState<TopTab>('preflop');

  // preflop の config/stem は URL から解決 (全コンフィグ新グリッド)。
  const route = useRoute();
  const { configId, stem } = parsePreflopRoute(route);
  const preflopConfig = findConfig(configId) ?? findConfig(DEFAULT_CONFIG_ID)!;

  // Flop タブの state (UI 主導 model)。
  const [flopPositions, setFlopPositions] = useState<Position[]>([]);
  const [flopBucket, setFlopBucket] = useState<PreflopBucket | null>(null);
  const [flopChain, setFlopChain] = useState<string[]>([]);
  const [flopSelectedBoard, setFlopSelectedBoard] = useState<string | null>(null);
  const handleFlopPositionsChange = useCallback((p: Position[]) => {
    setFlopPositions(p);
    setFlopChain([]);
  }, []);
  const handleFlopBucketChange = useCallback((b: PreflopBucket | null) => {
    setFlopBucket(b);
    setFlopChain([]);
  }, []);

  return (
    <div style={pageStyle}>
      <AppHeader showBack />
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1.5rem' }}>
        <header style={{ marginBottom: '1.25rem', position: 'relative' }}>
          <div style={eyebrowStyle}>
            Preflop Strategy Viewer
            <span style={{ marginLeft: '0.5rem', opacity: 0.6, letterSpacing: 'normal' }}>ver 1.0</span>
          </div>
          {viewportMode === 'pc' && (
            <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 700, color: THEME.textPrimary }}>
              {activeTab === 'preflop' ? 'Preflop Range' : 'Flop Strategy'}
            </h1>
          )}
          <button type="button" onClick={toggleViewport} title="PC版/モバイル版を切替" style={viewToggleStyle}>
            {viewportMode === 'pc' ? 'モバイル版' : 'PC版'}
          </button>
        </header>

        <TopTabs active={activeTab} onChange={setActiveTab} />

        {activeTab === 'preflop' && (
          <>
            <div style={{ marginBottom: '0.9rem' }}>
              <ConfigSelector current={preflopConfig} />
            </div>
            <RangeView config={preflopConfig.id} stem={stem} />
            <OpenStrategyTestArea />
          </>
        )}

        {activeTab === 'flop' &&
          (viewportMode === 'mobile' ? (
            <MobileFlopView
              positions={flopPositions}
              bucket={flopBucket}
              chain={flopChain}
              selectedBoardName={flopSelectedBoard}
              onPositionsChange={handleFlopPositionsChange}
              onBucketChange={handleFlopBucketChange}
              onChainChange={setFlopChain}
              onSelectBoard={setFlopSelectedBoard}
            />
          ) : (
            <FlopStrategyView
              positions={flopPositions}
              bucket={flopBucket}
              chain={flopChain}
              selectedBoardName={flopSelectedBoard}
              onPositionsChange={handleFlopPositionsChange}
              onBucketChange={handleFlopBucketChange}
              onChainChange={setFlopChain}
              onSelectBoard={setFlopSelectedBoard}
            />
          ))}

        <footer style={footerStyle}>GTO Wizard data</footer>
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
        <OpenStrategyTable hand={hand} />
        <ThreebetStrategyTable hand={hand} />
        <FourbetStrategyTable hand={hand} />
      </div>
    </details>
  );
}

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  background: THEME.bg,
  color: THEME.textPrimary,
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
};
const eyebrowStyle: CSSProperties = {
  fontSize: '0.7rem',
  color: THEME.textMuted,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  marginBottom: '0.2rem',
};
const viewToggleStyle: CSSProperties = {
  position: 'absolute',
  top: 0,
  right: 0,
  background: 'transparent',
  border: `1px solid ${THEME.borderStrong}`,
  borderRadius: '4px',
  padding: '4px 10px',
  fontSize: '11px',
  color: THEME.textSecondary,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
const footerStyle: CSSProperties = {
  marginTop: '1.5rem',
  fontSize: '0.7rem',
  color: THEME.textFaint,
  textAlign: 'center',
};
