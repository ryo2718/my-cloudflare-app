// Phase 10: App = ルーター shell。training/* も path で分岐。

import { useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { useIdleLogout } from './hooks/useIdleLogout';
import { navigate, useRoute } from './router/router-core';
import { TRAINING_CATALOG, isPlayable, type TrainingLevel } from './data/trainingCatalog';
import { AccountPage } from './components/AccountPage';
import { AchievementTierPage } from './components/AchievementTierPage';
import type { TierId } from './data/achievements';
import { HomePage } from './components/HomePage';
import { QuizPage } from './components/QuizPage';
import { RankingPage } from './components/RankingPage';
import { StrategyPage } from './components/StrategyPage';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AccountsList } from './components/admin/AccountsList';
import { GroupKeyForm } from './components/admin/GroupKeyForm';
import { UsersStatistics } from './components/admin/UsersStatistics';
import { MissedProblemsListPage } from './components/training/MissedProblemsListPage';
import { MissedProblemAnswerPage } from './components/training/MissedProblemAnswerPage';
import { MissedChallengePlayPage } from './components/training/MissedChallengePlayPage';
import { MissedChallengeResultPage } from './components/training/MissedChallengeResultPage';
import { TrainingConfirm } from './components/training/TrainingConfirm';
import { TrainingPlay } from './components/training/TrainingPlay';
import { TrainingPlayIntermediate } from './components/training/TrainingPlayIntermediate';
import { TrainingPlayPositional } from './components/training/TrainingPlayPositional';
import { TrainingResult } from './components/training/TrainingResult';
import { TrainingReview } from './components/training/TrainingReview';
import { TrainingRules } from './components/training/TrainingRules';

const TRAINING_LEVELS_FLAT: TrainingLevel[] = TRAINING_CATALOG.flatMap((c) => c.levels);

type TrainingMatch =
  | { level: TrainingLevel; screen: 'confirm' | 'play' | 'result' | 'rules' }
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
  const m = path.match(/^\/training\/([a-z_-]+)\/(confirm|play|result|rules)\/?$/);
  if (!m) return null;
  const slug = m[1];
  const screen = m[2] as 'confirm' | 'play' | 'result' | 'rules';
  const key = slug.replace(/-/g, '_');
  const level = TRAINING_LEVELS_FLAT.find((lv) => lv.key === key);
  if (!level) return null;
  return { level, screen };
}

export default function App() {
  const path = useRoute();
  const { account } = useAuth();
  useIdleLogout();

  useEffect(() => {
    if (path.startsWith('/admin') && account && !account.is_admin) {
      navigate('/');
    }
  }, [path, account]);

  // /quiz/review/preflop/{level}/answer/{id}: 答え合わせ画面 (復習)
  const answerMatch = path.match(
    /^\/quiz\/review\/preflop\/(beginner|intermediate)\/answer\/(\d+)\/?$/,
  );
  if (answerMatch) {
    const lv = answerMatch[1] as 'beginner' | 'intermediate';
    const id = Number(answerMatch[2]);
    if (Number.isFinite(id) && id > 0) {
      return <MissedProblemAnswerPage level={lv} id={id} />;
    }
  }
  // /quiz/review/preflop/{level}/play?count=N: 挑戦モード
  const playMatch = path.match(/^\/quiz\/review\/preflop\/(beginner|intermediate)\/play\/?$/);
  if (playMatch) {
    const lv = playMatch[1] as 'beginner' | 'intermediate';
    const params =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams();
    const countRaw = Number(params.get('count'));
    const count = Number.isFinite(countRaw) && countRaw > 0 ? Math.min(countRaw, 100) : 10;
    return <MissedChallengePlayPage level={lv} count={count} />;
  }
  // /quiz/review/preflop/{level}/result: 挑戦モード完了画面
  const resultMatch = path.match(/^\/quiz\/review\/preflop\/(beginner|intermediate)\/result\/?$/);
  if (resultMatch) {
    const lv = resultMatch[1] as 'beginner' | 'intermediate';
    return <MissedChallengeResultPage level={lv} />;
  }
  // /quiz/review/preflop/{level}: 復習リスト画面
  const listMatch = path.match(/^\/quiz\/review\/preflop\/(beginner|intermediate)\/?$/);
  if (listMatch) {
    const lv = listMatch[1] as 'beginner' | 'intermediate';
    return <MissedProblemsListPage level={lv} />;
  }

  // 互換: 旧 URL /quiz/review/{level}(/answer/{id}) を新形式にリダイレクト
  const legacyAnswer = path.match(
    /^\/quiz\/review\/(beginner|intermediate)\/answer\/(\d+)\/?$/,
  );
  if (legacyAnswer) {
    navigate(`/quiz/review/preflop/${legacyAnswer[1]}/answer/${legacyAnswer[2]}`);
    return null;
  }
  const legacyList = path.match(/^\/quiz\/review\/(beginner|intermediate)\/?$/);
  if (legacyList) {
    navigate(`/quiz/review/preflop/${legacyList[1]}`);
    return null;
  }

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
    if (screen === 'rules') return <TrainingRules level={level} />;
    if (screen === 'play') {
      // 中級ポジション別 (EP/LP/Blind): スライダー / ノード別複数選択 / limp 緩和
      if (
        level.key === 'preflop_intermediate_ep' ||
        level.key === 'preflop_intermediate_lp' ||
        level.key === 'preflop_intermediate_blind'
      ) {
        return <TrainingPlayPositional level={level} />;
      }
      // 中級総合は別コンポーネント (BB 応答・複数選択・タイマー・頻度採点)
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
  const tierMatch = path.match(/^\/account\/achievements\/(shrimp|fish|shark|whale)\/?$/);
  if (tierMatch) {
    const tier = tierMatch[1] as TierId;
    return <AchievementTierPage tier={tier} />;
  }

  if (path === '/admin' || path === '/admin/') {
    return account?.is_admin ? <AdminDashboard /> : <HomePage />;
  }
  if (path === '/admin/accounts') {
    return account?.is_admin ? <AccountsList /> : <HomePage />;
  }
  if (path === '/admin/users-statistics') {
    return account?.is_admin ? <UsersStatistics /> : <HomePage />;
  }
  if (path === '/admin/group-key') {
    return account?.is_admin ? <GroupKeyForm /> : <HomePage />;
  }

  return <HomePage />;
}
