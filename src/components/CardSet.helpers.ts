import type { CSSProperties } from 'react';

/** Pure style helper for CardSet container。 */
export function getCardSetStyle(gap: number): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: `${gap}px`,
  };
}
