// Phase 4: Flop タブ最下部の Flop レポートセクション (2 アコーディオン DONK / CB)。
//
// 役割:
//   - 選択中ボードを受け取り、各アコーディオンに渡す
//   - useFlopReportPreload で全 variant × 全 depth を裏で並列 fetch (cache 温め)
//   - 各アコーディオンの開閉 state を保持
//
// マウント時 (= Flop タブを開いた瞬間) からプリロードが走るので、ユーザがアコーディオン
// を開く頃には大半のセルが cache hit (ローディング表示無し or 1 frame のみ)。

import { useState, type CSSProperties } from 'react';
import { THEME } from '../styles/theme';
import { FlopReportAccordion } from './FlopReportAccordion';
import { useFlopReportPreload } from '../hooks/useFlopReportPreload';

export interface FlopReportSectionProps {
  /** Flop タブ全体で共有されている選択中ボード名 (正準化済 or null = 未選択)。 */
  board: string | null;
}

export function FlopReportSection({ board }: FlopReportSectionProps) {
  const [donkExpanded, setDonkExpanded] = useState(false);
  const [cbExpanded, setCbExpanded] = useState(false);

  // マウント + board 変更で fetch を温める (cache hit すれば即時 return)。
  useFlopReportPreload(board);

  return (
    <section style={sectionStyle} aria-labelledby="flop-report-heading">
      <div style={dividerStyle} aria-hidden />
      <header style={headerStyle}>
        <h2 id="flop-report-heading" style={titleStyle}>
          Flop レポート
        </h2>
        <span style={hintStyle}>
          選択中フロップ {board ? <code style={boardCodeStyle}>{board}</code> : '(未選択 → 全ボード平均)'}
        </span>
      </header>

      <div style={accordionStackStyle}>
        <FlopReportAccordion
          title="DONK"
          scenario="donk"
          board={board}
          expanded={donkExpanded}
          onToggle={() => setDonkExpanded((v) => !v)}
        />
        <FlopReportAccordion
          title="CB"
          scenario="cb"
          board={board}
          expanded={cbExpanded}
          onToggle={() => setCbExpanded((v) => !v)}
        />
      </div>
    </section>
  );
}

// ----------------------------------------------------------------------------
// Styles
// ----------------------------------------------------------------------------

const sectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.7rem',
  marginTop: '1.5rem',
};

const dividerStyle: CSSProperties = {
  height: 1,
  background: THEME.border,
  marginBottom: '0.5rem',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: '0.65rem',
  flexWrap: 'wrap',
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: '1rem',
  fontWeight: 700,
  color: THEME.textPrimary,
  letterSpacing: '0.02em',
};

const hintStyle: CSSProperties = {
  fontSize: '0.78rem',
  color: THEME.textSecondary,
};

const boardCodeStyle: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  color: THEME.accent,
};

const accordionStackStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.55rem',
};
