// Phase 10: App = ルーター shell。training/* も path で分岐。

import { useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { navigate, useRoute } from './router/router-core';
import { TRAINING_CATALOG, isPlayable, type TrainingLevel } from './data/trainingCatalog';
import { AccountPage } from './components/AccountPage';
import { HomePage } from './components/HomePage';
import { QuizPage } from './components/QuizPage';
import { RankingPage } from './components/RankingPage';
import { StrategyPage } from './components/StrategyPage';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AccountsList } from './components/admin/AccountsList';
import { GroupKeyForm } from './components/admin/GroupKeyForm';
import { TrainingConfirm } from './components/training/TrainingConfirm';
import { TrainingPlay } from './components/training/TrainingPlay';
import { TrainingPlayIntermediate } from './components/training/TrainingPlayIntermediate';
import { TrainingResult } from './components/training/TrainingResult';
import { TrainingReview } from './components/training/TrainingReview';

const TRAINING_LEVELS_FLAT: TrainingLevel[] = TRAINING_CATALOG.flatMap((c) => c.levels);

type TrainingMatch =
  | { level: TrainingLevel; screen: 'confirm' | 'play' | 'result' }
  | { level: TrainingLevel; screen: 'review'; index: number };

function matchTrainingRoute(path: string): TrainingMatch | null {
  // /training/<slug>/review/<n>
  const review = path.match(/^\/training\/([a-z_-]+)\/review\/(\d+)\/?$/);
  if (review) {
    const slug = review[1];
    const index = Number(review[2]);
    if (!Number.isFinite(index) || index < 1) return null;
    const key = slug.replace(/-/g, '_');
    const level = TRAINING_LEVELS_FLAT.find((lv) => lv.key === key);
    if (!level) return null;
    return { level, screen: 'review', index };
  }
  // /training/<slug>/<screen>
  const m = path.match(/^\/training\/([a-z_-]+)\/(confirm|play|result)\/?$/);
  if (!m) return null;
  const slug = m[1];
  const screen = m[2] as 'confirm' | 'play' | 'result';
  const key = slug.replace(/-/g, '_');
  const level = TRAINING_LEVELS_FLAT.find((lv) => lv.key === key);
  if (!level) return null;
  return { level, screen };
}

export default function App() {
  const path = useRoute();
  const { account } = useAuth();

  useEffect(() => {
    if (path.startsWith('/admin') && account && !account.is_admin) {
      navigate('/');
    }
  }, [path, account]);

  // training routes
  const trainingMatch = matchTrainingRoute(path);
  if (trainingMatch) {
    const { level, screen } = trainingMatch;
    // 未実装 level に直接 URL アクセスされた場合は /quiz にリダイレクト (useEffect で副作用化)
    if (!isPlayable(level)) {
      // intentional side effect
      navigate('/quiz');
      return null;
    }
    if (screen === 'confirm') return <TrainingConfirm level={level} />;
    if (screen === 'play') {
      // 中級は別コンポーネント (BB 応答・複数選択・タイマー・頻度採点)
      return level.key === 'preflop_intermediate'
        ? <TrainingPlayIntermediate level={level} />
        : <TrainingPlay level={level} />;
    }
    if (screen === 'result') return <TrainingResult level={level} />;
    if (screen === 'review') return <TrainingReview level={level} index={trainingMatch.index} />;
  }

  if (path === '/strategy') return <StrategyPage />;
  if (path === '/quiz') return <QuizPage />;
  if (path === '/ranking') return <RankingPage />;
  if (path === '/account') return <AccountPage />;

  if (path === '/admin' || path === '/admin/') {
    return account?.is_admin ? <AdminDashboard /> : <HomePage />;
  }
  if (path === '/admin/accounts') {
    return account?.is_admin ? <AccountsList /> : <HomePage />;
  }
  if (path === '/admin/group-key') {
    return account?.is_admin ? <GroupKeyForm /> : <HomePage />;
  }

  return <HomePage />;
}
