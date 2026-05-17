// 開発用 hidden ページ。`/__dev__/flop-report-cell` で表示される。
//
// 目的: Phase 2 で実装した FlopReportCell が「単一セルとして」正しく動くかの目視確認。
//   - depth 切替 (srp / 3bp / 4bp / 5bp)
//   - scenario 切替 (donk / cb)
//   - board 指定 (null = 全ボード平均 / プリセット数件)
//   - 取得失敗ケース (意図的に variant-depth mismatch)
//
// 本機能 (matrix UI) は Phase 3 で別ページとして実装するので、この demo は通常の
// ナビゲーションには出さない (App.tsx で DEV-only に分岐)。

import { useMemo, useState, type CSSProperties } from 'react';
import { THEME } from '../../styles/theme';
import {
  enumerateMatchups,
  FLOP_REPORT_DEPTHS,
  type FlopReportDepth,
  type MatchupCell,
} from '../../data/flopReport';
import { FlopReportCell } from '../../components/FlopReportCell';
import { FlopReportMatrix } from '../../components/FlopReportMatrix';

const SCENARIOS = ['donk', 'cb'] as const;
type Scenario = (typeof SCENARIOS)[number];

const BOARD_PRESETS: ReadonlyArray<{ label: string; value: string | null }> = [
  { label: '全ボード平均', value: null },
  { label: '2h2d2c (低 ドライ)', value: '2h2d2c' },
  { label: 'AsKsQs (高 モノ)', value: 'AsKsQs' },
  { label: 'Qs Ts 7h (例)', value: 'QsTs7h' },
];

export function FlopReportCellDemo() {
  const [depth, setDepth] = useState<FlopReportDepth>('srp');
  const [scenario, setScenario] = useState<Scenario>('cb');
  const [board, setBoard] = useState<string | null>(null);

  const cells = useMemo(() => enumerateMatchups(depth), [depth]);

  // 意図的エラーセル: variant='utgr_bbc' (SRP の variant) だが depth='3bp' で渡す
  // → loadFlopReportCell 側で "Variant mismatch" throw → 'err' 表示
  const errorCell: MatchupCell = useMemo(
    () => ({
      oop: 'BB',
      ip: 'UTG',
      depth: '3bp',
      variant: 'utgr_bbc', // SRP variant を 3bp depth に渡す (mismatch)
      aggressor: 'UTG',
      caller: 'BB',
      donkApplicable: true,
      cbApplicable: true,
      cbNodeChain: ['bb_x'],
      donkNodeChain: [],
    }),
    [],
  );

  return (
    <div style={pageStyle}>
      <div style={maxWidthStyle}>
        <header style={{ marginBottom: '1.25rem' }}>
          <div style={eyebrowStyle}>__dev__</div>
          <h1 style={titleStyle}>Flop Report Cell — Demo</h1>
          <div style={subtitleStyle}>
            Phase 2 動作確認用。<code>/__dev__/flop-report-cell</code>{' '}
            (DEV ビルドのみ可視)。
          </div>
        </header>

        {/* 制御パネル: depth / scenario / board */}
        <section style={controlPanelStyle}>
          <ControlGroup label="Depth">
            {FLOP_REPORT_DEPTHS.map((d) => (
              <Pill key={d} active={d === depth} onClick={() => setDepth(d)}>
                {d}
              </Pill>
            ))}
          </ControlGroup>
          <ControlGroup label="Scenario">
            {SCENARIOS.map((s) => (
              <Pill key={s} active={s === scenario} onClick={() => setScenario(s)}>
                {s.toUpperCase()}
              </Pill>
            ))}
          </ControlGroup>
          <ControlGroup label="Board">
            {BOARD_PRESETS.map((b) => (
              <Pill
                key={b.label}
                active={b.value === board}
                onClick={() => setBoard(b.value)}
              >
                {b.label}
              </Pill>
            ))}
          </ControlGroup>
        </section>

        {/* メイン: 6×6 マトリクス (案B レイアウト) */}
        <section>
          <h2 style={sectionTitleStyle}>
            6×6 マトリクス ({depth.toUpperCase()} × {scenario.toUpperCase()})
          </h2>
          <FlopReportMatrix depth={depth} scenario={scenario} board={board} />
          <Legend />
        </section>

        {/* 既存: セル単体プレビュー (15 マッチアップ grid) */}
        <section style={{ marginTop: '1.75rem' }}>
          <h2 style={sectionTitleStyle}>
            セル単体プレビュー ({depth.toUpperCase()} × {scenario.toUpperCase()},{' '}
            {cells.length} cells)
          </h2>
          <div style={cellGridStyle}>
            {cells.map((cell) => (
              <CellWithLabel
                key={`${cell.oop}-${cell.ip}-${cell.depth}-${scenario}-${board ?? 'null'}`}
                cell={cell}
                depth={depth}
                scenario={scenario}
                board={board}
              />
            ))}
          </div>
        </section>

        {/* エラー検証セル */}
        <section style={{ marginTop: '1.5rem' }}>
          <h2 style={sectionTitleStyle}>意図的エラー (variant-depth mismatch)</h2>
          <div style={{ fontSize: '0.78rem', color: THEME.textMuted, marginBottom: '0.5rem' }}>
            variant=<code>utgr_bbc</code> (SRP) を depth=<code>3bp</code> で渡し、
            <code>loadFlopReportCell</code> 内の整合性チェックで throw する経路を確認。
          </div>
          <CellWithLabel
            cell={errorCell}
            depth="3bp"
            scenario="cb"
            board={null}
          />
        </section>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------------

function CellWithLabel({
  cell,
  depth,
  scenario,
  board,
}: {
  cell: MatchupCell;
  depth: FlopReportDepth;
  scenario: Scenario;
  board: string | null;
}) {
  return (
    <div style={cellWrapStyle}>
      <div style={cellLabelStyle}>
        <span style={cellLabelPairStyle}>
          {cell.oop} <span style={{ opacity: 0.5 }}>vs</span> {cell.ip}
        </span>
        {cell.variant && (
          <span style={cellLabelVariantStyle}>{cell.variant}</span>
        )}
      </div>
      <FlopReportCell
        matchup={cell}
        depth={depth}
        scenario={scenario}
        board={board}
      />
    </div>
  );
}

function Legend() {
  return (
    <div style={legendStyle}>
      <LegendItem swatchColor="#FAC775" label="◎ 80%+" />
      <LegendItem swatchColor="#FAEEDA" label="○ 50–80%" />
      <LegendItem swatchColor="#FCF5E2" label="△ 20–50%" />
      <LegendItem swatchColor="#F1EFE8" label="× &lt;20%" />
      <span style={legendNaStyle}>— データなし / 同ポジション</span>
    </div>
  );
}

function LegendItem({ swatchColor, label }: { swatchColor: string; label: string }) {
  return (
    <span style={legendItemStyle}>
      <span style={{ ...legendSwatchStyle, background: swatchColor }} />
      {label}
    </span>
  );
}

function ControlGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={controlGroupStyle}>
      <span style={controlLabelStyle}>{label}</span>
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>{children}</div>
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={active ? pillActiveStyle : pillStyle}
    >
      {children}
    </button>
  );
}

// ----------------------------------------------------------------------------
// Styles
// ----------------------------------------------------------------------------

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  background: THEME.bg,
  color: THEME.textPrimary,
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
  padding: '1.5rem',
};

const maxWidthStyle: CSSProperties = { maxWidth: '1400px', margin: '0 auto' };

const eyebrowStyle: CSSProperties = {
  fontSize: '0.7rem',
  color: THEME.errorText,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  marginBottom: '0.2rem',
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: '1.5rem',
  fontWeight: 700,
  color: THEME.textPrimary,
};

const subtitleStyle: CSSProperties = {
  fontSize: '0.78rem',
  color: THEME.textSecondary,
  marginTop: '0.2rem',
};

const controlPanelStyle: CSSProperties = {
  background: THEME.card,
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.5rem',
  padding: '0.85rem 1rem',
  marginBottom: '1.25rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.65rem',
};

const controlGroupStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.85rem',
};

const controlLabelStyle: CSSProperties = {
  fontSize: '0.7rem',
  color: THEME.textSecondary,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  fontWeight: 700,
  minWidth: '60px',
};

const pillStyle: CSSProperties = {
  background: 'transparent',
  color: THEME.textSecondary,
  border: `1px solid ${THEME.border}`,
  borderRadius: '999px',
  padding: '0.25rem 0.75rem',
  fontSize: '0.78rem',
  fontFamily: 'inherit',
  cursor: 'pointer',
};

const pillActiveStyle: CSSProperties = {
  ...pillStyle,
  background: THEME.accent,
  color: '#fff',
  borderColor: THEME.accent,
  fontWeight: 600,
};

const sectionTitleStyle: CSSProperties = {
  fontSize: '0.95rem',
  fontWeight: 600,
  margin: '0 0 0.65rem',
  color: THEME.textPrimary,
};

const cellGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
  gap: '0.65rem',
};

const cellWrapStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.25rem',
};

const cellLabelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  fontSize: '0.7rem',
  color: THEME.textSecondary,
  lineHeight: 1.25,
};

const cellLabelPairStyle: CSSProperties = {
  fontWeight: 600,
};

const cellLabelVariantStyle: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  fontSize: '0.62rem',
  color: THEME.textFaint,
};

const legendStyle: CSSProperties = {
  display: 'flex',
  gap: '12px',
  flexWrap: 'wrap',
  fontSize: '11px',
  color: THEME.textSecondary,
  marginTop: '12px',
  alignItems: 'center',
};

const legendItemStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
};

const legendSwatchStyle: CSSProperties = {
  display: 'inline-block',
  width: '14px',
  height: '14px',
  borderRadius: '3px',
  border: `1px solid ${THEME.border}`,
};

const legendNaStyle: CSSProperties = {
  color: THEME.textMuted,
};
