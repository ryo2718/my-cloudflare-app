// 1問ごとの制限時間カウントダウン (中級・初級の制限時間ありモードで共有)。
// 3プレイ画面で重複していた実装を集約。挙動は従来と同一。

import { useEffect, useState, type CSSProperties } from 'react';
import { THEME } from '../../styles/theme';

export function Countdown({ seconds, onTimeUp }: { seconds: number; onTimeUp: () => void }) {
  const [remaining, setRemaining] = useState(seconds);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRemaining(seconds);
    const startedAt = Date.now();
    const tick = window.setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - startedAt) / 1000);
      const newRemaining = Math.max(0, seconds - elapsedSec);
      setRemaining(newRemaining);
      if (newRemaining <= 0) {
        window.clearInterval(tick);
        onTimeUp();
      }
    }, 200);
    return () => window.clearInterval(tick);
  }, [seconds, onTimeUp]);

  const danger = remaining <= 5;
  return (
    <div
      style={{
        ...timerStyle,
        color: danger ? '#b91c1c' : THEME.textPrimary,
        borderColor: danger ? '#b91c1c' : THEME.border,
      }}
      aria-live="polite"
    >
      残り {remaining}s
    </div>
  );
}

const timerStyle: CSSProperties = {
  alignSelf: 'center',
  margin: '0.5rem 0',
  padding: '0.3rem 0.8rem',
  border: '1.5px solid',
  borderRadius: '999px',
  fontSize: '0.95rem',
  fontWeight: 700,
  fontVariantNumeric: 'tabular-nums',
};
