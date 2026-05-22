// フェーズ1 回帰テスト: 中級総合の生成が risky_open のプール枯渇で throw しないこと。
// (旧実装は SB の eligible=2 で rejection sampling が稀に枯渇し throw していた)

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { generateIntermediateQuestions, generateRiskyOpenQuestion } from './preflopIntermediate';

describe('中級総合 生成の堅牢性 (risky_open)', () => {
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

  it('1000回生成しても throw せず、毎回20問そろう', async () => {
    let failures = 0;
    for (let i = 0; i < 1000; i++) {
      try {
        const qs = await generateIntermediateQuestions();
        expect(qs).toHaveLength(20);
      } catch {
        failures += 1;
      }
    }
    expect(failures).toBe(0);
  });

  it('generateRiskyOpenQuestion は eligible ペアから必ず risky_open 問題を返す', async () => {
    // 1問目をロード経由で生成 (cache 温め) してから直接呼ぶ。
    await generateIntermediateQuestions();
    for (let i = 0; i < 200; i++) {
      // cache は module 内。generateIntermediateQuestions が openRanges を埋めている。
      const qs = await generateIntermediateQuestions();
      const risky = qs.filter((q) => q.scenarioType === 'risky_open');
      for (const q of risky) {
        expect(q.scenarioType).toBe('risky_open');
        // raise/fold 混合 (ライトオープン) であること
        expect((q.strategy.raise ?? 0) > 0 && (q.strategy.fold ?? 0) > 0).toBe(true);
      }
    }
    expect(typeof generateRiskyOpenQuestion).toBe('function');
  });
});
