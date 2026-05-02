import { THEME } from '../../styles/theme';

/**
 * モバイル版アプリ — Phase 1 ではプレースホルダのみ。
 * 後続 Phase で:
 *   Phase 2 ポジション選択 (3列×2行ボタン) / Breadcrumb / レンジ表 1個 / Aggregate バー
 *   Phase 3 3bet / All-in ボタン + 階層ループ
 *   Phase 4 Hand Range / Hand Eval タブ
 *   Phase 5 Solution セレクト + ポリッシュ
 */
export function MobileApp() {
  return (
    <div
      style={{
        padding: '2rem 1rem',
        textAlign: 'center',
        color: THEME.textSecondary,
        background: THEME.card,
        border: `1px solid ${THEME.border}`,
        borderRadius: '0.5rem',
      }}
    >
      <h2
        style={{
          margin: '0 0 0.5rem',
          fontSize: '1.2rem',
          fontWeight: 700,
          color: THEME.textPrimary,
        }}
      >
        モバイル版（実装中）
      </h2>
      <p style={{ margin: 0, fontSize: '0.85rem' }}>Phase 2 で実装予定</p>
      <p
        style={{
          margin: '0.75rem 0 0',
          fontSize: '0.75rem',
          color: THEME.textMuted,
        }}
      >
        ヘッダー右上の「PC版」ボタンで PC 版に切替できます
      </p>
    </div>
  );
}
