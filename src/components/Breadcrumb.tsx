import { THEME } from '../styles/theme';

export interface BreadcrumbItem {
  label: string;
}

interface Props {
  items: ReadonlyArray<BreadcrumbItem>;
  /** index === -1 で Home (完全リセット)、それ以上で当該エントリに巻き戻し。 */
  onNavigate: (index: number) => void;
}

export function Breadcrumb({ items, onNavigate }: Props) {
  return (
    <nav
      aria-label="Action history"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '0.35rem',
        fontSize: '0.78rem',
        color: THEME.textSecondary,
      }}
    >
      <Crumb label="Home" onClick={() => onNavigate(-1)} active={items.length === 0} />
      {items.map((item, idx) => (
        <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ color: THEME.textFaint }}>›</span>
          <Crumb
            label={item.label}
            onClick={() => onNavigate(idx)}
            active={idx === items.length - 1}
          />
        </span>
      ))}
    </nav>
  );
}

function Crumb({
  label,
  onClick,
  active,
}: {
  label: string;
  onClick: () => void;
  active: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'transparent',
        border: 'none',
        padding: '0.15rem 0.4rem',
        color: active ? THEME.textPrimary : THEME.textSecondary,
        fontSize: 'inherit',
        fontWeight: active ? 700 : 500,
        cursor: 'pointer',
        textDecoration: active ? 'none' : 'underline',
        textDecorationColor: THEME.textFaint,
        textUnderlineOffset: '0.2rem',
        borderRadius: '0.25rem',
      }}
    >
      {label}
    </button>
  );
}
