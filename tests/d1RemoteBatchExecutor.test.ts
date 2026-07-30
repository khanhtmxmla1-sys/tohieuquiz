// @vitest-environment node

import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  buildRemoteBatchWorkerSource,
  normalizeBatchStatements,
} = require('../workers/scripts/run-d1-remote-batch.cjs');

describe('D1 remote batch executor', () => {
  it('removes manual transaction control before calling D1.batch()', () => {
    expect(normalizeBatchStatements(`
      PRAGMA foreign_keys=ON;
      BEGIN IMMEDIATE;
      INSERT INTO example(id) VALUES ('one');
      DELETE FROM example WHERE id='two';
      COMMIT;
    `)).toEqual([
      "INSERT INTO example(id) VALUES ('one')",
      "DELETE FROM example WHERE id='two'",
    ]);
  });

  it('builds a one-purpose worker without embedding the raw authorization token', () => {
    const source = buildRemoteBatchWorkerSource({
      proofDigest: 'token-hash-value',
      payloadHash: 'payload-hash-value',
      expectedStatementCount: 2,
    });

    expect(source).toContain('env.DB.batch');
    expect(source).toContain('token-hash-value');
    expect(source).toContain('payload-hash-value');
    expect(source).toContain('expectedStatementCount = 2');
    expect(source).not.toContain('raw-secret-token');
    expect(source).not.toMatch(/BEGIN|COMMIT|SAVEPOINT/);
  });
});
