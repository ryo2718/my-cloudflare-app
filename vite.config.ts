import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',            // 純関数中心、DOM 不要
    include: ['src/**/*.test.ts'],  // *.test.tsx は将来 React component 用
    globals: false,                 // describe/it/expect は明示 import で
  },
})
