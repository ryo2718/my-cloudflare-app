/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Flop tree データ配信元の base URL (R2 public bucket、`/v1/<config>` まで含む)。
   * 例: `https://pub-xxxxxxxx.r2.dev/data/flop/v1/cash_100bb_6max_nl500_2.5x`
   * 設定は `.env.local` (開発) / Cloudflare Pages 環境変数 (本番)。
   */
  readonly VITE_FLOP_DATA_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
