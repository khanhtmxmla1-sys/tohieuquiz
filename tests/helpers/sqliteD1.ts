import type { DatabaseSync, StatementResultingChanges } from 'node:sqlite';

type SqliteBindValue = string | number | bigint | Uint8Array | null;

function normalizeBindValue(value: unknown): SqliteBindValue {
  if (value === undefined) return null;
  if (
    value === null
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'bigint'
    || value instanceof Uint8Array
  ) return value;
  return String(value);
}

function resultMeta(result?: StatementResultingChanges) {
  return {
    duration: 0,
    size_after: 0,
    rows_read: 0,
    rows_written: result ? Number(result.changes) : 0,
    last_row_id: result ? Number(result.lastInsertRowid) : 0,
    changed_db: Boolean(result && Number(result.changes) > 0),
  };
}

class SqlitePreparedStatement {
  constructor(
    private readonly db: DatabaseSync,
    readonly sql: string,
    readonly params: SqliteBindValue[] = [],
  ) {}

  bind(...values: unknown[]): D1PreparedStatement {
    return new SqlitePreparedStatement(
      this.db,
      this.sql,
      values.map(normalizeBindValue),
    ) as unknown as D1PreparedStatement;
  }

  async first<T = Record<string, unknown>>(column?: string): Promise<T | null> {
    const row = this.db.prepare(this.sql).get(...this.params) as Record<string, unknown> | undefined;
    if (!row) return null;
    if (column) return (row[column] ?? null) as T | null;
    return row as T;
  }

  async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const results = this.db.prepare(this.sql).all(...this.params) as T[];
    return {
      success: true,
      results,
      meta: resultMeta(),
    } as D1Result<T>;
  }

  async run<T = unknown>(): Promise<D1Result<T>> {
    const result = this.db.prepare(this.sql).run(...this.params);
    return {
      success: true,
      results: [] as T[],
      meta: resultMeta(result),
    } as D1Result<T>;
  }

  async raw<T = unknown>(): Promise<T[][]> {
    const rows = this.db.prepare(this.sql).all(...this.params) as Array<Record<string, T>>;
    return rows.map((row) => Object.values(row));
  }
}

export function createSqliteD1(database: DatabaseSync): D1Database {
  const adapter = {
    prepare(sql: string) {
      return new SqlitePreparedStatement(database, sql) as unknown as D1PreparedStatement;
    },
    async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<Array<D1Result<T>>> {
      const internal = statements as unknown as SqlitePreparedStatement[];
      database.exec('BEGIN IMMEDIATE');
      try {
        const results: Array<D1Result<T>> = [];
        for (const statement of internal) {
          const result = database.prepare(statement.sql).run(...statement.params);
          results.push({
            success: true,
            results: [] as T[],
            meta: resultMeta(result),
          } as D1Result<T>);
        }
        database.exec('COMMIT');
        return results;
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    },
    async exec(sql: string) {
      database.exec(sql);
      return { count: 0, duration: 0 } as D1ExecResult;
    },
    dump: async () => new ArrayBuffer(0),
    withSession() {
      throw new Error('sqliteD1 test adapter does not implement sessions');
    },
  };
  return adapter as unknown as D1Database;
}
