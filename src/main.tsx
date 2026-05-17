import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { FlopReportCellDemo } from './pages/__dev__/FlopReportCellDemo';
import { AuthProvider } from './contexts/AuthContext';
import { LoginGate } from './components/LoginGate';

// DEV-only hidden ルート。`/__dev__/flop-report-cell` を URL 直打ちで開いた場合のみ
// Demo を mount し、App は完全にバイパスする (認証ゲートも無し)。
// (App 側で early-return すると hooks 規約に違反するため、entry で分岐する。
//  別コンポーネントを切ると react-refresh ルールに引っかかるので JSX 式で直接渡す。)
const isDevReportRoute =
  import.meta.env.DEV &&
  typeof window !== 'undefined' &&
  window.location.pathname.startsWith('/__dev__/flop-report-cell');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isDevReportRoute ? (
      <FlopReportCellDemo />
    ) : (
      // Phase B: 認証ゲートで本アプリを覆う。未認証時は LoginGate が表示される。
      <AuthProvider>
        <LoginGate>
          <App />
        </LoginGate>
      </AuthProvider>
    )}
  </StrictMode>,
);
