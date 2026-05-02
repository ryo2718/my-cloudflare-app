import { THEME } from '../styles/theme';
import { SUIT_COLOR, SUIT_SYMBOL, type Suit } from '../types/card';

interface Props {
  /** 1文字を末尾に追加 */
  onAppend: (char: string) => void;
  onBackspace: () => void;
  onClear: () => void;
}

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const;
const SUITS: ReadonlyArray<Suit> = ['s', 'h', 'd', 'c'];

/**
 * スクリーンキーボード:
 *   Row 1: ランク 13個 (A→2)
 *   Row 2: スート 4個 (♠♥♦♣) + タイプ 2個 (s, o)
 *   Row 3: Backspace, Clear
 *
 * 注: スートの 's' とタイプの 's' は同じ文字を append するが、parseHandInput 側が
 *     入力長で曖昧解消する。
 */
export function HandKeyboard({ onAppend, onBackspace, onClear }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        background: THEME.card,
        border: `1px solid ${THEME.border}`,
        borderRadius: '0.5rem',
        padding: '0.6rem',
      }}
    >
      {/* Row 1: ranks */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(13, 1fr)', gap: '4px' }}>
        {RANKS.map((r) => (
          <Key key={r} label={r} onClick={() => onAppend(r)} />
        ))}
      </div>

      {/* Row 2: suits + type */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          {SUITS.map((u) => (
            <Key
              key={u}
              label={SUIT_SYMBOL[u]}
              color={SUIT_COLOR[u]}
              wide
              onClick={() => onAppend(u)}
              title={`${SUIT_SYMBOL[u]} (suit)`}
            />
          ))}
        </div>
        <div style={{ width: '1.25rem' }} />
        <div style={{ display: 'flex', gap: '4px' }}>
          <Key label="s" wide onClick={() => onAppend('s')} title="suited" />
          <Key label="o" wide onClick={() => onAppend('o')} title="offsuit" />
        </div>
      </div>

      {/* Row 3: backspace / clear */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <Key label="⌫ Backspace" wide onClick={onBackspace} flex />
        <Key label="Clear" wide onClick={onClear} flex />
      </div>
    </div>
  );
}

interface KeyProps {
  label: string;
  onClick: () => void;
  color?: string;
  /** 横長キー (rank の正方形と区別) */
  wide?: boolean;
  /** flex: 1 で行いっぱい埋める */
  flex?: boolean;
  title?: string;
}

function Key({ label, onClick, color, wide, flex, title }: KeyProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? label}
      style={{
        background: THEME.cardElevated,
        border: `1px solid ${THEME.border}`,
        borderRadius: '0.375rem',
        color: color ?? THEME.textPrimary,
        fontSize: wide ? '0.95rem' : '0.95rem',
        fontWeight: 700,
        padding: wide ? '0.45rem 0.7rem' : '0.45rem 0',
        cursor: 'pointer',
        userSelect: 'none',
        minWidth: wide ? '2.5rem' : 'auto',
        flex: flex ? 1 : undefined,
        aspectRatio: wide ? undefined : '1',
        fontFamily: 'ui-monospace, SFMono-Regular, monospace',
        transition: 'background 0.05s',
      }}
      onMouseDown={(e) => {
        // クリック時に input から focus を奪わないようにする (物理キーボード入力と共存させるため)
        e.preventDefault();
      }}
    >
      {label}
    </button>
  );
}
