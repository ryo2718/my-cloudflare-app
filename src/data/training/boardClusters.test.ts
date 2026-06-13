// ボードクラスタ: マッピングの妥当性 + クラスタ層化ラウンドロビン抽選。

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  getClusterId,
  getRepresentative,
  getAllClusterIds,
  CLUSTER_COUNT,
  sampleByClusterRoundRobin,
} from './boardClusters';

const CLUSTERS = JSON.parse(readFileSync('public/data/flop/board-clusters.json', 'utf8')) as {
  representatives: Array<{ cluster_id: number; board: string }>;
  mapping: Record<string, number>;
};

// 全収録ボード (training + rangebet)
const ALL_BOARDS: string[] = [];
{
  const tr = JSON.parse(readFileSync('public/data/flop/flop_training_v1.json', 'utf8'));
  for (const pot of Object.keys(tr.cb)) for (const band of Object.keys(tr.cb[pot])) for (const x of tr.cb[pot][band]) ALL_BOARDS.push(x.board);
  for (const band of Object.keys(tr.donk)) for (const x of tr.donk[band]) ALL_BOARDS.push(x.board);
  const rb = JSON.parse(readFileSync('public/data/flop/flop_rangebet_v1.json', 'utf8'));
  for (const cat of Object.keys(rb.cb)) for (const x of rb.cb[cat]) ALL_BOARDS.push(x.board);
  for (const x of rb.donk ?? []) ALL_BOARDS.push(x.board);
  for (const x of rb.bmcb ?? []) ALL_BOARDS.push(x.board);
}

describe('board-clusters マッピング', () => {
  it('クラスタ数 = 54 (49 + mono/trips 被覆穴 5)', () => {
    expect(CLUSTER_COUNT).toBe(54);
    expect(getAllClusterIds().length).toBe(54);
    expect(CLUSTERS.representatives.length).toBe(54);
  });

  it('全収録ボードに有効な cluster_id (0..53) が振られる', () => {
    for (const b of ALL_BOARDS) {
      const id = getClusterId(b);
      expect(id).not.toBeNull();
      expect(id! >= 0 && id! < CLUSTER_COUNT).toBe(true);
    }
  });

  it('代表は必ず自分のクラスタに属する (rep ⇒ 自クラスタ)', () => {
    CLUSTERS.representatives.forEach((r) => {
      expect(getClusterId(r.board)).toBe(r.cluster_id);
      expect(getRepresentative(r.cluster_id)).toBe(r.board);
    });
  });

  it('全クラスタが非空 (代表自身を含むため最低 1)', () => {
    const size: Record<number, number> = {};
    for (const b of ALL_BOARDS) {
      const id = getClusterId(b)!;
      size[id] = (size[id] ?? 0) + 1;
    }
    for (const id of getAllClusterIds()) expect(size[id] ?? 0).toBeGreaterThan(0);
  });

  it('スート同型は同じクラスタ (AsKs3h と AhKh3d など)', () => {
    expect(getClusterId('AsKs3h')).toBe(getClusterId('AhKh3d'));
    expect(getClusterId('QsJhTd')).toBe(getClusterId('QdJsTh'));
  });

  it('不正なボード文字列は null', () => {
    expect(getClusterId('ZZZZZZ')).toBeNull();
  });
});

describe('sampleByClusterRoundRobin', () => {
  const POOL = [...new Set(ALL_BOARDS)];

  it('count 件・重複なし・全て pool 内', () => {
    const got = sampleByClusterRoundRobin(POOL, 20);
    expect(got.length).toBe(20);
    expect(new Set(got).size).toBe(20);
    const pset = new Set(POOL);
    for (const b of got) expect(pset.has(b)).toBe(true);
  });

  it('クラスタ網羅優先: count <= クラスタ数 なら全て別クラスタ', () => {
    const got = sampleByClusterRoundRobin(POOL, 20);
    const clusters = got.map((b) => getClusterId(b));
    expect(new Set(clusters).size).toBe(got.length); // 20 問が 20 クラスタ
  });

  it('excludeBoards (スート同型一致) を除外する', () => {
    const exclude = new Set(['AsKs3h']);
    for (let i = 0; i < 30; i++) {
      const got = sampleByClusterRoundRobin(POOL, 25, { excludeBoards: exclude });
      // 同型 (AhKh3d 等) も含め除外ボードは出ない
      const excludedCluster = getClusterId('AsKs3h');
      for (const b of got) {
        if (getClusterId(b) === excludedCluster) {
          expect(getClusterId(b)).toBe(excludedCluster); // 同クラスタは可
          expect(b).not.toBe('AsKs3h'); // ただし除外ボードそのものは不可
        }
      }
    }
  });
});
