// Phase 2a: 新 preflop strategy タブ (/strategy-v2)。既存 /strategy とは別系統で並存。
// URL: /strategy-v2 | /strategy-v2/<config> | /strategy-v2/<config>/<chainStem>
// 既存のカスタムルーター (router-core) を使う。pathname からセグメントを解析して分岐。

import { type CSSProperties } from 'react';
import { useRoute } from '../../router/router-core';
import { AppHeader } from '../AppHeader';
import { THEME } from '../../styles/theme';
import { ConfigPicker } from './ConfigPicker';
import { PositionPicker } from './PositionPicker';
import { RangeView } from './RangeView';
import { segmentsAfterBase } from './route';

export function StrategyV2Page() {
  const path = useRoute();
  const segs = segmentsAfterBase(path);

  let content;
  if (segs.length === 0) {
    content = <ConfigPicker />;
  } else if (segs.length === 1) {
    content = <PositionPicker config={segs[0]} />;
  } else {
    content = <RangeView config={segs[0]} stem={segs[1]} />;
  }

  return (
    <div style={pageStyle}>
      <AppHeader showBack />
      <main style={mainStyle}>{content}</main>
    </div>
  );
}

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  background: THEME.bg,
  display: 'flex',
  flexDirection: 'column',
};
const mainStyle: CSSProperties = {
  flex: 1,
  padding: '1rem',
  maxWidth: 520,
  width: '100%',
  margin: '0 auto',
};
