// Phase 10: App = ルーター shell。training/* も path で分岐。

import { useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { useIdleLogout } from './hooks/useIdleLogout';
import { usePendingResultsFlush } from './hooks/usePendingResultsFlush';
import { navigate, useRoute } from './router/router-core';
import { isPlayable } from './data/trainingCatalog';
import { AccountPage } from './components/AccountPage';
import { AchievementTierPage } from './components/AchievementTierPage';
import type { TierId } from './data/achievements';
import { HomePage } from './components/HomePage';
import { EquityCalculatorPage } from './components/equity/EquityCalculatorPage';
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
import { FlopMissedListPage, FlopMissedPlayPage } from './components/training/FlopMissedPage';
import type { FlopTrainingType } from './api/missedProblems';
import { parseMissedFilter } from './components/training/missedChallengeStore';
import type { MissedLevel } from './api/missedProblems';
import { TrainingConfirm } from './components/training/TrainingConfirm';
import { TrainingPlay } from './components/training/TrainingPlay';
import { TrainingPlayFlop } from './components/training/TrainingPlayFlop';
import { TrainingPlayFlopIntermediate } from './components/training/TrainingPlayFlopIntermediate';
import { TrainingPlayFlopPerHandCb } from './components/training/TrainingPlayFlopPerHandCb';
import { TrainingPlayBeginnerOpen } from './components/training/TrainingPlayBeginnerOpen';
import { TrainingPlayBeginnerVsOpen } from './components/training/TrainingPlayBeginnerVsOpen';
import { TrainingPlayIntermediate } from './components/training/TrainingPlayIntermediate';
import { TrainingPlayPositional } from './components/training/TrainingPlayPositional';
import { TrainingResultPositional } from './components/training/TrainingResultPositional';
import { TrainingResultFlop } from './components/training/TrainingResultFlop';
import { TrainingResultFlopIntermediate } from './components/training/TrainingResultFlopIntermediate';
import { TrainingResultFlopPerHandCb } from './components/training/TrainingResultFlopPerHandCb';
import { TrainingResult } from './components/training/TrainingResult';
import { TrainingReview } from './components/training/TrainingReview';
import { TrainingRules } from './components/training/TrainingRules';

import { matchTrainingRoute } from './router/trainingRoute';

export default function App() {
  const path = useRoute();
  const { account } = useAuth();
  useIdleLogout();
  // 認証時に、保存失敗で退避した成績スコアを再送 (再ログイン後の自動復旧)。
  usePendingResultsFlush();

  useEffect(() => {
    if (path.startsWith('/admin') && account && !account.is_admin) {
      navigate('/');
    }
  }, [path, account]);

  // /quiz/review/preflop/{level}/answer/{id}: 答え合わせ画面 (復習)
  const answerMatch = path.match(
    /^\/quiz\/review\/preflop\/(beginner|intermediate|ep|lp|blind)\/answer\/(\d+)\/?$/,
  );
  if (answerMatch) {
    const lv = answerMatch[1] as MissedLevel;
    const id = Number(answerMatch[2]);
    if (Number.isFinite(id) && id > 0) {
      return <MissedProblemAnswerPage level={lv} id={id} />;
    }
  }
  // /quiz/review/preflop/{level}/play?count=N&filter=F: 挑戦モード
  const playMatch = path.match(/^\/quiz\/review\/preflop\/(beginner|intermediate|ep|lp|blind)\/play\/?$/);
  if (playMatch) {
    const lv = playMatch[1] as MissedLevel;
    const params =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams();
    const countRaw = Number(params.get('count'));
    const count = Number.isFinite(countRaw) && countRaw > 0 ? Math.min(countRaw, 100) : 10;
    const filter = parseMissedFilter(params.get('filter'));
    return <MissedChallengePlayPage level={lv} count={count} filter={filter} />;
  }
  // /quiz/review/preflop/{level}/result: 挑戦モード完了画面
  const resultMatch = path.match(/^\/quiz\/review\/preflop\/(beginner|intermediate|ep|lp|blind)\/result\/?$/);
  if (resultMatch) {
    const lv = resultMatch[1] as MissedLevel;
    return <MissedChallengeResultPage level={lv} />;
  }
  // /quiz/review/preflop/{level}: 復習リスト画面
  const listMatch = path.match(/^\/quiz\/review\/preflop\/(beginner|intermediate|ep|lp|blind)\/?$/);
  if (listMatch) {
    const lv = listMatch[1] as MissedLevel;
    return <MissedProblemsListPage level={lv} />;
  }

  // /quiz/review/flop/{training_type}(/play): ポストフロップの間違えた問題 一覧 / 再出題
  const flopReviewMatch = path.match(
    /^\/quiz\/review\/flop\/(flop_beginner|flop_cb_srp|flop_cb_3bp|flop_donk_bmcb)(\/play)?\/?$/,
  );
  if (flopReviewMatch) {
    const tt = flopReviewMatch[1] as FlopTrainingType;
    return flopReviewMatch[2]
      ? <FlopMissedPlayPage trainingType={tt} />
      : <FlopMissedListPage trainingType={tt} />;
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
      // 初級オープン: 各ポジションの open 頻度をスライダーで回答 (優しい採点・50s)。
      if (level.key === 'preflop_beginner_open') {
        return <TrainingPlayBeginnerOpen level={level} />;
      }
      // 初級 vs オープン: 相手のオープンへの応答を複数選択 (優しい採点・50s)。
      if (level.key === 'preflop_beginner_vs_open') {
        return <TrainingPlayBeginnerVsOpen level={level} />;
      }
      // 中級ポジション別 (EP/LP/Blind): スライダー / ノード別複数選択 / limp 緩和
      if (
        level.key === 'preflop_intermediate_ep' ||
        level.key === 'preflop_intermediate_lp' ||
        level.key === 'preflop_intermediate_blind'
      ) {
        return <TrainingPlayPositional level={level} />;
      }
      // フロップ初級 (ボード2択: CB/ドンク)
      if (level.key === 'flop_beginner') {
        return <TrainingPlayFlop level={level} />;
      }
      // フロップ CB / ドンクBMCB (CB SRP / CB 3BP4BP5BP / ドンク/BMCB, ともにサイズ複数選択)
      if (level.key === 'flop_cb_srp' || level.key === 'flop_cb_3bp' || level.key === 'flop_donk_bmcb') {
        return <TrainingPlayFlopIntermediate level={level} />;
      }
      // フロップ中級CB (個別ハンド: ボード×ハンドで c-bet サイズを複数選択)
      if (level.key === 'flop_intermediate_cb') {
        return <TrainingPlayFlopPerHandCb level={level} />;
      }
      // 中級総合は別コンポーネント (BB 応答・複数選択・タイマー・頻度採点)
      return level.key === 'preflop_intermediate'
        ? <TrainingPlayIntermediate level={level} />
        : <TrainingPlay level={level} />;
    }
    if (screen === 'result') {
      if (
        level.key === 'preflop_intermediate_ep' ||
        level.key === 'preflop_intermediate_lp' ||
        level.key === 'preflop_intermediate_blind'
      ) {
        return <TrainingResultPositional level={level} />;
      }
      if (level.key === 'flop_beginner') {
        return <TrainingResultFlop level={level} />;
      }
      if (level.key === 'flop_cb_srp' || level.key === 'flop_cb_3bp' || level.key === 'flop_donk_bmcb') {
        return <TrainingResultFlopIntermediate level={level} />;
      }
      if (level.key === 'flop_intermediate_cb') {
        return <TrainingResultFlopPerHandCb level={level} />;
      }
      return <TrainingResult level={level} />;
    }
    if (screen === 'review') return <TrainingReview level={level} index={trainingMatch.index} />;
  }

  if (path === '/strategy') return <StrategyPage />;
  if (path === '/equity') return <EquityCalculatorPage />;
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
