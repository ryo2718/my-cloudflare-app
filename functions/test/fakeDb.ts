// テスト用の D1Database スタブ。実 DB には一切書き込まず、実行された SQL と
// バインド引数を記録する。.first() の戻り値は firstResolver で制御する。

export interface ExecRecord {
  sql: string;
  args: unknown[];
}

export interface FakeDb {
  db: D1Database;
  /** prepare().bind().first()/run() および batch() で実行された文の記録。 */
  exec: ExecRecord[];
}

type FirstResolver = (sql: string, args: unknown[]) => unknown;

interface BoundStmt {
  bind: (...a: unknown[]) => BoundStmt;
  first: () => Promise<unknown>;
  run: () => Promise<{ success: boolean }>;
  all: () => Promise<{ results: unknown[]; success: boolean }>;
  __sql: string;
  __args: unknown[];
}

/** firstResolver: SELECT 等の .first() が返す行を SQL/引数から決める (既定 null)。 */
export function makeFakeDb(firstResolver?: FirstResolver): FakeDb {
  const exec: ExecRecord[] = [];

  function stmt(sql: string, args: unknown[]): BoundStmt {
    return {
      bind: (...a: unknown[]) => stmt(sql, a),
      first: async () => {
        exec.push({ sql, args });
        return (firstResolver ? firstResolver(sql, args) : null) ?? null;
      },
      run: async () => {
        exec.push({ sql, args });
        return { success: true };
      },
      all: async () => {
        exec.push({ sql, args });
        return { results: [], success: true };
      },
      __sql: sql,
      __args: args,
    };
  }

  const db = {
    prepare: (sql: string) => stmt(sql, []),
    batch: async (stmts: BoundStmt[]) => {
      for (const s of stmts) exec.push({ sql: s.__sql, args: s.__args });
      return stmts.map(() => ({ success: true }));
    },
  };

  return { db: db as unknown as D1Database, exec };
}

/** Authorization 付き POST リクエストを作る。 */
export function postRequest(body: unknown): Request {
  return new Request('https://example.test/api', {
    method: 'POST',
    headers: { Authorization: 'Bearer test-session', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
