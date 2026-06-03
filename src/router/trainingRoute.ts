// トレーニング URL (/training/<slug>/<screen>) のマッチング。
// slug は level.key の '_' を '-' にしたもの。**数字を含む** (例: flop-cb-3bp) ため
// スラッグの文字クラスには 0-9 を含める (これを欠くと数字入り level がルート外れ → ホームに戻る)。

import { TRAINING_CATALOG, type TrainingLevel } from '../data/trainingCatalog';

const TRAINING_LEVELS_FLAT: TrainingLevel[] = TRAINING_CATALOG.flatMap((c) => c.levels);

export type TrainingMatch =
  | { level: TrainingLevel; screen: 'confirm' | 'play' | 'result' | 'rules' }
  | { level: TrainingLevel; screen: 'review'; index: number };

export function matchTrainingRoute(path: string): TrainingMatch | null {
  // /training/<slug>/review/<n>
  const review = path.match(/^\/training\/([a-z0-9_-]+)\/review\/(\d+)\/?$/);
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
  const m = path.match(/^\/training\/([a-z0-9_-]+)\/(confirm|play|result|rules)\/?$/);
  if (!m) return null;
  const slug = m[1];
  const screen = m[2] as 'confirm' | 'play' | 'result' | 'rules';
  const key = slug.replace(/-/g, '_');
  const level = TRAINING_LEVELS_FLAT.find((lv) => lv.key === key);
  if (!level) return null;
  return { level, screen };
}
