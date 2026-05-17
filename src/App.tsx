// Phase C 以降: App = ルーター shell。実画面は components/*Page.tsx に分割。
//
// ルート一覧:
//   /                  → HomePage (Strategy / Quiz 選択)
//   /strategy          → StrategyPage (旧 App.tsx の中身、Preflop + Flop)
//   /quiz              → QuizPage (placeholder)
//   /admin             → AdminDashboard (admin only)
//   /admin/accounts    → AccountsList
//   /admin/group-key   → GroupKeyForm
//   その他              → HomePage に fallback
//
// 認証は <LoginGate> (main.tsx) で覆われており、本コンポーネントは認証済前提。
// 非 admin が /admin/* に来た場合は HomePage に redirect (副作用は useEffect 内で navigate)。

import { useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { navigate, useRoute } from './router/router-core';
import { HomePage } from './components/HomePage';
import { QuizPage } from './components/QuizPage';
import { StrategyPage } from './components/StrategyPage';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AccountsList } from './components/admin/AccountsList';
import { GroupKeyForm } from './components/admin/GroupKeyForm';

export default function App() {
  const path = useRoute();
  const { account } = useAuth();

  // 非 admin が /admin/* に直接訪れたらホームへ強制送還。
  // (admin 化される前のセッションが残っているケース等)
  useEffect(() => {
    if (path.startsWith('/admin') && account && !account.is_admin) {
      navigate('/');
    }
  }, [path, account]);

  if (path === '/strategy') return <StrategyPage />;
  if (path === '/quiz') return <QuizPage />;

  if (path === '/admin' || path === '/admin/') {
    return account?.is_admin ? <AdminDashboard /> : <HomePage />;
  }
  if (path === '/admin/accounts') {
    return account?.is_admin ? <AccountsList /> : <HomePage />;
  }
  if (path === '/admin/group-key') {
    return account?.is_admin ? <GroupKeyForm /> : <HomePage />;
  }

  // / または未知のパスは HomePage に fallback (404 ページは別途必要なら Phase F)。
  return <HomePage />;
}
