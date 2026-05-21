// 中級ポジション別のシナリオピル色。
// vs 5bet 系 (EP/LP の opener が 5bet ジャムを受ける) のみ黒系、他はオレンジ系。

import type { CSSProperties } from 'react';
import { isVs5betScenario } from '../../data/training/preflopIntermediatePositional';

const ORANGE_PILL: CSSProperties = {
  alignSelf: 'flex-start',
  fontSize: '0.78rem',
  fontWeight: 700,
  color: '#993C1D',
  background: '#FAEEDA',
  border: '1px solid #E5A551',
  borderRadius: '999px',
  padding: '0.2rem 0.7rem',
};

const BLACK_PILL: CSSProperties = {
  ...ORANGE_PILL,
  color: '#2C2C2A',
  background: '#EFEDE8',
  border: '1px solid #2C2C2A',
};

/** scenarioKey に応じたピル style。vs 5bet のみ黒。 */
export function positionalPillStyle(scenarioKey: string): CSSProperties {
  return isVs5betScenario(scenarioKey) ? BLACK_PILL : ORANGE_PILL;
}
