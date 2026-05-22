// 中級LP: 同一問題の重複出題が解消したことの検証 (lp_vs_4bet 6→3 / lp_vs_3bet 6→9)。
//
// 修正前は完全一致重複が約84%・scenario:hand 重複が100%のセッションで発生していた。
// 修正後は実質ゼロ (実測 N=5000 で完全一致 2件 ≈ 0.04%) まで激減する。
// 厳密な数学的0には届かない (lp_vs_4bet の4ハンドがノード間で不均等 + 選定がランダム +
// リトライ上限のため、稀少ハンドを引けず末尾フォールバックで重複を採る確率がごく僅か残る)。
// そのため「厳密0」ではなく堅牢な低しきい値で検証する (fragile/flaky を避ける)。

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { generatePositionalQuestions } from './preflopIntermediatePositional';

const SESSIONS = 500;

beforeAll(() => {
  vi.stubGlobal('fetch', async (url: string) => {
    const rel = (url as string).replace(/^\//, '');
    try {
      const t = await readFile(path.join(process.cwd(), 'public', rel), 'utf8');
      return { ok: true, status: 200, json: async () => JSON.parse(t) } as Response;
    } catch {
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    }
  });
});
afterAll(() => vi.unstubAllGlobals());

describe('中級LP 重複出題が解消', () => {
  it('完全一致重複・scenario:hand 重複ともに <1% (修正前は84%/100%)、総数は常に20', async () => {
    let fullDupSessions = 0;
    let scenHandDupSessions = 0;
    for (let s = 0; s < SESSIONS; s++) {
      const qs = await generatePositionalQuestions('lp');
      expect(qs.length).toBe(20); // 総数20不変
      const full = new Set<string>();
      const sh = new Set<string>();
      let hadFull = false;
      let hadSH = false;
      for (const q of qs) {
        const fk = `${q.scenarioKey}|${q.myPosition}|${q.opener}|${q.threeBettor}|${q.hand}`;
        const shk = `${q.scenarioKey}:${q.hand}`;
        if (full.has(fk)) hadFull = true;
        full.add(fk);
        if (sh.has(shk)) hadSH = true;
        sh.add(shk);
      }
      if (hadFull) fullDupSessions += 1;
      if (hadSH) scenHandDupSessions += 1;
    }
    // 実測 ≈0.04% / 0.08%。margin を持たせ flaky を避ける (<1%)。
    expect(fullDupSessions / SESSIONS).toBeLessThan(0.01);
    expect(scenHandDupSessions / SESSIONS).toBeLessThan(0.01);
  }, 60000);
});
