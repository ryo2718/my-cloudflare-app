import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Dev 専用: R2 への CORS 回避のための proxy。
    // app 側は `.env.development.local` で `VITE_FLOP_DATA_BASE_URL=/r2-flop` を指す。
    // 同一オリジン fetch になるので LAN-IP (スマホ) からアクセスしても CORS で弾かれない。
    // 本番 build には影響しない (Vite proxy は dev 限定機能)。
    proxy: {
      '/r2-flop': {
        target: 'https://pub-15ae08e085da4c138ef4f04dde1dbfeb.r2.dev',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/r2-flop/, '/data/flop/v1/cash_100bb_6max_nl500_2.5x'),
      },
    },
  },
  test: {
    environment: 'node',            // 純関数中心、DOM 不要
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'functions/**/*.test.ts'],  // ts: 純関数 / functions: サーバーハンドラ、tsx: React component
    globals: false,                 // describe/it/expect は明示 import で
  },
})
