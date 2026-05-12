// Flop variant の 3 軸セレクタ (opener × responder × pot 深度 + SB-only open/limp トグル)。
//
// 仕様: docs/FLOP_UX_SPEC.md §2.2, §2.3 と §7-5bp (通常表示、disable で対応)。
// 5bp や非対応の組合せは disabled で表示 (=「データなし」)。

import type { CSSProperties } from 'react';
import type { Position } from '../types/strategy';
import { OPENER_POSITIONS, getValidResponders, type OpenerPosition } from '../data/scenarios';
import {
  findFlopVariants,
  getFlopOpener,
  getFlopResponder,
  getPotDepth,
  type PotDepth,
  type OpenerAction,
} from '../data/flopVariants';
import { THEME } from '../styles/theme';

interface Props {
  variant: string;
  onVariantChange: (variant: string) => void;
}

const POT_DEPTHS: ReadonlyArray<PotDepth> = ['limp', 'SRP', '3bp', '4bp', '5bp'];
const POT_DEPTH_LABELS: Record<PotDepth, string> = {
  limp: 'Limp',
  SRP: 'SRP',
  '3bp': '3-bet',
  '4bp': '4-bet',
  '5bp': '5-bet',
};

export function FlopVariantSelector({ variant, onVariantChange }: Props) {
  // variant から現在の状態を導出 (single source of truth)
  const opener = getFlopOpener(variant);
  const responder = getFlopResponder(variant);
  const depth = getPotDepth(variant);
  const openerAction: OpenerAction = variant.startsWith('sbc_') ? 'limp' : 'open';

  const isSBOpener = opener === 'SB';
  const validResponders = getValidResponders(opener as OpenerPosition);

  // 4 軸を渡して variant を探す → 見つかれば反映
  const trySetVariant = (
    o: Position,
    r: Position,
    d: PotDepth,
    a: OpenerAction,
  ): boolean => {
    const matches = findFlopVariants(o, r, d, a);
    if (matches.length > 0) {
      onVariantChange(matches[0]);
      return true;
    }
    return false;
  };

  // depth の lookup を試みて、無ければ他の depth でフォールバック
  const tryWithFallback = (o: Position, r: Position, a: OpenerAction): void => {
    if (trySetVariant(o, r, depth, a)) return;
    for (const d of POT_DEPTHS) {
      if (trySetVariant(o, r, d, a)) return;
    }
  };

  const handleOpenerChange = (newOpener: Position) => {
    const newValidResponders = getValidResponders(newOpener as OpenerPosition);
    const newResponder = newValidResponders.includes(responder)
      ? responder
      : newValidResponders[0];
    // SB 以外は openerAction を 'open' に強制
    const newAction: OpenerAction = newOpener === 'SB' ? openerAction : 'open';
    tryWithFallback(newOpener, newResponder, newAction);
  };

  const handleResponderChange = (newResponder: Position) => {
    tryWithFallback(opener, newResponder, openerAction);
  };

  const handleDepthChange = (newDepth: PotDepth) => {
    trySetVariant(opener, responder, newDepth, openerAction);
  };

  const handleOpenerActionChange = (newAction: OpenerAction) => {
    if (opener !== 'SB') return;
    // limp → 'limp' depth default、open → 'SRP' default
    const defaultDepth: PotDepth = newAction === 'limp' ? 'limp' : 'SRP';
    trySetVariant('SB', responder, defaultDepth, newAction);
  };

  const isDepthEnabled = (d: PotDepth): boolean =>
    findFlopVariants(opener, responder, d, openerAction).length > 0;

  return (
    <div style={containerStyle}>
      {/* Row 1: Opener */}
      <div style={rowStyle}>
        <span style={labelStyle}>Opener</span>
        <select
          value={opener}
          onChange={(e) => handleOpenerChange(e.target.value as Position)}
          style={selectStyle}
        >
          {OPENER_POSITIONS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        {/* SB 限定: open/limp トグル */}
        {isSBOpener && (
          <div style={{ display: 'inline-flex', gap: '4px', marginLeft: '0.5rem' }}>
            <button
              type="button"
              onClick={() => handleOpenerActionChange('open')}
              style={openerAction === 'open' ? toggleActiveStyle : toggleStyle}
            >
              Open
            </button>
            <button
              type="button"
              onClick={() => handleOpenerActionChange('limp')}
              style={openerAction === 'limp' ? toggleActiveStyle : toggleStyle}
            >
              Limp
            </button>
          </div>
        )}
      </div>

      {/* Row 2: Responder */}
      <div style={rowStyle}>
        <span style={labelStyle}>Responder</span>
        <select
          value={responder}
          onChange={(e) => handleResponderChange(e.target.value as Position)}
          style={selectStyle}
        >
          {validResponders.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {/* Row 3: Pot depth (segmented control) */}
      <div style={rowStyle}>
        <span style={labelStyle}>Pot Depth</span>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {POT_DEPTHS.map((d) => {
            const enabled = isDepthEnabled(d);
            const active = d === depth;
            const style = active
              ? depthActiveStyle
              : !enabled
              ? depthDisabledStyle
              : depthStyle;
            return (
              <button
                key={d}
                type="button"
                disabled={!enabled}
                onClick={() => handleDepthChange(d)}
                style={style}
                title={!enabled ? 'データなし' : undefined}
              >
                {POT_DEPTH_LABELS[d]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected variant display (debug 用、Phase 5 で削除しても OK) */}
      <div style={variantHintStyle}>
        Variant: <code>{variant}</code>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Styles
// ----------------------------------------------------------------------------

const containerStyle: CSSProperties = {
  background: THEME.card,
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.5rem',
  padding: '1rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.7rem',
};

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.65rem',
  flexWrap: 'wrap',
};

const labelStyle: CSSProperties = {
  fontSize: '0.7rem',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: THEME.textSecondary,
  fontWeight: 700,
  minWidth: '90px',
};

const selectStyle: CSSProperties = {
  background: THEME.cardElevated,
  color: THEME.textPrimary,
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.375rem',
  padding: '0.45rem 0.8rem',
  fontSize: '0.95rem',
  fontWeight: 600,
  cursor: 'pointer',
  minWidth: '110px',
};

const toggleStyle: CSSProperties = {
  background: 'transparent',
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.375rem',
  padding: '0.4rem 0.75rem',
  fontSize: '0.85rem',
  color: THEME.textMuted,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const toggleActiveStyle: CSSProperties = {
  ...toggleStyle,
  background: THEME.cardElevated,
  border: `1px solid ${THEME.borderStrong}`,
  color: THEME.textPrimary,
  fontWeight: 600,
};

const depthStyle: CSSProperties = {
  background: THEME.cardElevated,
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.375rem',
  padding: '0.45rem 0.9rem',
  fontSize: '0.85rem',
  color: THEME.textSecondary,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const depthActiveStyle: CSSProperties = {
  ...depthStyle,
  background: THEME.accent,
  border: `1px solid ${THEME.accentHover}`,
  color: '#fff',
  fontWeight: 600,
};

const depthDisabledStyle: CSSProperties = {
  ...depthStyle,
  background: THEME.bg,
  color: THEME.textFaint,
  cursor: 'not-allowed',
  opacity: 0.5,
};

const variantHintStyle: CSSProperties = {
  fontSize: '0.72rem',
  color: THEME.textMuted,
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
};
