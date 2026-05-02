import type { Action } from '../types/strategy';
import { THEME } from '../styles/theme';

interface Props {
  hand: string;
  frequencies: number[];
  actions: Action[];
  hovered: boolean;
  onHover: (hand: string | null) => void;
}

export function HandCell({ hand, frequencies, actions, hovered, onHover }: Props) {
  let cumulative = 0;
  const stops: string[] = [];
  frequencies.forEach((freq, i) => {
    if (freq <= 0) return;
    const start = cumulative * 100;
    cumulative += freq;
    const end = cumulative * 100;
    stops.push(`${actions[i].color} ${start}%, ${actions[i].color} ${end}%`);
  });

  const background =
    stops.length > 0 ? `linear-gradient(to top, ${stops.join(', ')})` : THEME.cellEmpty;

  return (
    <div
      onMouseEnter={() => onHover(hand)}
      onMouseLeave={() => onHover(null)}
      style={{
        background,
        position: 'relative',
        aspectRatio: '1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.6rem',
        fontWeight: 700,
        // 白文字 + 黒halo の textShadow で、明色背景 (cellEmpty) でも色付き背景 (raise赤等) でも可読
        color: '#ffffff',
        textShadow:
          '0 1px 2px rgba(0,0,0,0.65), 0 0 1px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,0.45)',
        border: hovered
          ? `2px solid ${THEME.accentHover}`
          : '1px solid #000000',
        cursor: 'pointer',
        transition: 'transform 0.1s, border 0.1s',
        transform: hovered ? 'scale(1.18)' : 'scale(1)',
        zIndex: hovered ? 10 : 1,
        userSelect: 'none',
      }}
    >
      {hand}
    </div>
  );
}
