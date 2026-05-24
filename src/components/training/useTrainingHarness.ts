// トレーニングプレイ画面の共通ハーネス (3プレイ画面で重複していた配線を集約)。
//   - 状態機械 (loading / error / ready{questions,current,records})
//   - 問題生成ロード、記録 store クリア
//   - 回答処理 (onAnswer)、即時フィードバック制御 (feedback)、次へ (onProceed)
//   - advance (採点レコード追加 → 次問 or 完了)
//   - animReady (アクションアニメ完了でタイマー開始) の問題切替リセット
//   - beforeunload (離脱警告)
//
// モード固有の差分 (生成・採点・レコード生成・完了処理) は config のコールバックで吸収する。
// 既存3画面の挙動 (出題フロー・採点・記録・タイマー・離脱警告) を変えないこと。

import { useEffect, useRef, useState } from 'react';
import { useSessionKeepAlive } from '../../hooks/useSessionKeepAlive';

export type HarnessState<Q, Rec> =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; questions: Q[]; current: number; records: Rec[] };

export interface TrainingHarnessConfig<Q, R, Rec> {
  /** 問題生成。reloadKey が変わるたびに再実行。 */
  load: () => Promise<Q[]>;
  /** load 開始前の副作用 (例: 記録 store のクリア)。 */
  onLoadStart?: () => void;
  /** 再ロードのトリガ (level.key 等)。 */
  reloadKey: string;
  /** 即時フィードバック ON/OFF。 */
  instant: boolean;
  /** 表示用の獲得pt (記録される素点と一致させること)。 */
  scorePoints: (q: Q, res: R) => number;
  /** 回答確定時の記録レコード生成 (index は 0 始まり)。 */
  buildRecord: (q: Q, res: R, index: number) => Rec;
  /** 全問終了時: 保存・記録送信・結果画面遷移 (mode 固有)。 */
  finish: (records: Rec[]) => void;
}

export interface TrainingHarness<Q, R, Rec> {
  state: HarnessState<Q, Rec>;
  /** ready のとき現在 index、それ以外 -1。 */
  current: number;
  /** ready のとき現在の問題、それ以外 null。 */
  question: Q | null;
  animReady: boolean;
  setAnimReady: (b: boolean) => void;
  /** 即時フィードバック表示中の保留回答 (points = 表示用素点)。 */
  feedback: { res: R; points: number } | null;
  /** 回答受領: instant ON ならフィードバック表示、OFF なら即確定。 */
  onAnswer: (res: R) => void;
  /** 「次のハンドへ」: 保留回答を確定して次へ。 */
  onProceed: () => void;
  /** デバッグ (admin): 全問を picker の回答で一括確定し finish へ。 */
  debugComplete: (pick: (q: Q) => R) => void;
}

export function useTrainingHarness<Q, R, Rec>(
  config: TrainingHarnessConfig<Q, R, Rec>,
): TrainingHarness<Q, R, Rec> {
  const { load, onLoadStart, reloadKey, instant, scorePoints, buildRecord, finish } = config;
  // プレイ中はサーバセッションを延命 (5分アイドル失効で成績保存が401になるのを防ぐ)。
  useSessionKeepAlive();
  const [state, setState] = useState<HarnessState<Q, Rec>>({ kind: 'loading' });
  const [feedback, setFeedback] = useState<{ res: R; points: number } | null>(null);
  const [animReady, setAnimReady] = useState(false);
  const advancingRef = useRef(false);

  const currentIdx = state.kind === 'ready' ? state.current : -1;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAnimReady(false);
  }, [currentIdx]);

  // 途中離脱警告 (回答途中のみ)。
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (state.kind !== 'ready' || state.current >= state.questions.length) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [state]);

  // 問題生成 (reloadKey 変化で再ロード)。
  useEffect(() => {
    let cancelled = false;
    onLoadStart?.();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ kind: 'loading' });
    load()
      .then((questions) => {
        if (cancelled) return;
        if (questions.length === 0) {
          setState({ kind: 'error', message: '出題データの読み込みに失敗しました' });
          return;
        }
        setState({ kind: 'ready', questions, current: 0, records: [] });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  const commit = (res: R) => {
    if (state.kind !== 'ready') return;
    if (advancingRef.current) return;
    advancingRef.current = true;
    const prev = state;
    const q = prev.questions[prev.current];
    const records = [...prev.records, buildRecord(q, res, prev.current)];
    const next = prev.current + 1;
    if (next >= prev.questions.length) {
      finish(records);
      return;
    }
    setState({ kind: 'ready', questions: prev.questions, current: next, records });
    Promise.resolve().then(() => {
      advancingRef.current = false;
    });
  };

  const onAnswer = (res: R) => {
    if (state.kind !== 'ready') return;
    if (instant) {
      if (feedback) return; // 表示中の重複回答を無視
      setFeedback({ res, points: scorePoints(state.questions[state.current], res) });
      return;
    }
    commit(res);
  };

  const onProceed = () => {
    if (!feedback) return;
    const res = feedback.res;
    setFeedback(null);
    commit(res);
  };

  // デバッグ (admin 専用): 全問を picker の回答で一括確定して finish。
  const debugComplete = (pick: (q: Q) => R) => {
    if (state.kind !== 'ready') return;
    const records = state.questions.map((q, i) => buildRecord(q, pick(q), i));
    finish(records);
  };

  return {
    state,
    current: currentIdx,
    question: state.kind === 'ready' ? state.questions[state.current] : null,
    animReady,
    setAnimReady,
    feedback,
    onAnswer,
    onProceed,
    debugComplete,
  };
}
