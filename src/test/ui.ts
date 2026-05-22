// UIテスト用ヘルパー。
// 各UIテストファイルは先頭に `// @vitest-environment jsdom` を付け、ここから render/screen/userEvent を import する。
// この import の副作用で各テスト後に testing-library の cleanup が走る (globals: false のため明示登録)。
// node 環境のロジックテストはこのファイルを import しないので影響を受けない。

import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

afterEach(() => {
  cleanup();
});

export * from '@testing-library/react';
export { userEvent };
