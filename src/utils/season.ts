// シーズン制ユーティリティ (クライアント側)。
//   サーバー側 functions/lib/season.ts と同一ロジック。
//   シーズン定義: 5-6月 / 7-8月 / 9-10月 / 11-12月 / 1-2月 / 3-4月 (年 6 シーズン)
//   season_id 形式: 'YYYY-MM' (開始月 5/7/9/11/1/3)

export interface SeasonInfo {
  id: string;
  number: number;
  name: string;
}

const SEASON_START_MONTHS = [5, 7, 9, 11, 1, 3] as const;

function seasonStartMonth(month: number): number {
  return month % 2 === 0 ? month - 1 : month;
}

export function currentSeason(now: Date = new Date()): SeasonInfo {
  const month = now.getMonth() + 1;
  const start = seasonStartMonth(month);
  const end = start === 12 ? 1 : start + 1;
  const year = now.getFullYear();
  const id = `${year}-${String(start).padStart(2, '0')}`;
  const idx = SEASON_START_MONTHS.indexOf(start as (typeof SEASON_START_MONTHS)[number]);
  const number = idx + 1;
  const name = `シーズン${number} (${year}年 ${start}-${end}月)`;
  return { id, number, name };
}
