#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let quote = null;
  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1];
    if (quote) {
      current += char;
      if (char === quote) {
        if (next === quote) {
          current += next;
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      current += char;
      continue;
    }
    if (char === ';') {
      if (current.trim()) statements.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

function normalizeBatchStatements(sql) {
  return splitSqlStatements(sql).filter((statement) => !/^(?:PRAGMA\s+foreign_keys\s*=|BEGIN\b|COMMIT\b|ROLLBACK\b|SAVEPOINT\b|RELEASE\b)/i.test(statement));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function buildRemoteBatchWorkerSource({ proofDigest, payloadHash, expectedStatementCount }) {
  return `const proofDigest = ${JSON.stringify(proofDigest)};
const payloadHash = ${JSON.stringify(payloadHash)};
const expectedStatementCount = ${Number(expectedStatementCount)};

async function digest(value) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') {
      return Response.json({ ready: true });
    }
    if (request.method !== 'POST' || url.pathname !== '/execute') {
      return new Response('Not found', { status: 404 });
    }
    const authorization = request.headers.get('authorization') || '';
    const presentedProof = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!presentedProof || await digest(presentedProof) !== proofDigest) {
      return new Response('Forbidden', { status: 403 });
    }
    const body = await request.text();
    if (await digest(body) !== payloadHash) {
      return new Response('Payload mismatch', { status: 409 });
    }
    const parsed = JSON.parse(body);
    if (!Array.isArray(parsed.statements) || parsed.statements.length !== expectedStatementCount) {
      return new Response('Statement count mismatch', { status: 409 });
    }
    if (parsed.statements.some((statement) => typeof statement !== 'string' || !statement.trim())) {
      return new Response('Invalid statement', { status: 400 });
    }
    const results = await env.DB.batch(parsed.statements.map((statement) => env.DB.prepare(statement)));
    const changes = results.reduce((total, result) => total + Number(result?.meta?.changes || 0), 0);
    return Response.json({ ok: true, count: results.length, changes });
  },
};
`;
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function stopProcess(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
  } else {
    child.kill('SIGTERM');
  }
}

async function waitForHealth(url, child, logBuffer, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Wrangler remote dev exited before becoming ready. ${logBuffer.join('').slice(-8000)}`);
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (response.ok) return;
    } catch {
      // Remote dev is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error(`Wrangler remote dev did not become ready. ${logBuffer.join('').slice(-8000)}`);
}

async function executeD1RemoteBatch({
  cwd,
  databaseName,
  databaseId,
  sql,
  startupTimeoutMs = 120000,
}) {
  const statements = normalizeBatchStatements(sql);
  if (statements.length === 0) throw new Error('No D1 batch statements were provided.');

  const oneTimeProof = crypto.randomBytes(32).toString('base64url');
  const body = JSON.stringify({ statements });
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'tohieuquiz-d1-remote-batch-'));
  const sourcePath = path.join(tempDirectory, 'batch-worker.mjs');
  const configPath = path.join(tempDirectory, 'wrangler.json');
  const workerName = `tohieuquiz-task38-${crypto.randomBytes(6).toString('hex')}`;
  const proofDigest = sha256(oneTimeProof);
  const payloadHash = sha256(body);
  const port = await getFreePort();
  const inspectorPort = await getFreePort();
  const wranglerBin = path.join(cwd, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
  if (!fs.existsSync(wranglerBin)) throw new Error(`Wrangler binary not found at ${wranglerBin}`);

  fs.writeFileSync(sourcePath, buildRemoteBatchWorkerSource({
    proofDigest,
    payloadHash,
    expectedStatementCount: statements.length,
  }), { encoding: 'utf8', mode: 0o600 });
  fs.writeFileSync(configPath, `${JSON.stringify({
    name: workerName,
    main: 'batch-worker.mjs',
    compatibility_date: '2026-07-30',
    d1_databases: [{
      binding: 'DB',
      database_name: databaseName,
      database_id: databaseId,
      remote: true,
    }],
  }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });

  const logs = [];
  let child;
  try {
    child = spawn(process.execPath, [
      wranglerBin,
      'dev',
      '--config', configPath,
      '--remote',
      '--ip', '127.0.0.1',
      '--port', String(port),
      '--inspector-port', String(inspectorPort),
      '--log-level', 'error',
      '--show-interactive-dev-session=false',
    ], {
      cwd: tempDirectory,
      env: { ...process.env, NO_COLOR: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    child.stdout.on('data', (chunk) => logs.push(String(chunk)));
    child.stderr.on('data', (chunk) => logs.push(String(chunk)));

    const baseUrl = `http://127.0.0.1:${port}`;
    await waitForHealth(`${baseUrl}/health`, child, logs, startupTimeoutMs);
    const response = await fetch(`${baseUrl}/execute`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${oneTimeProof}`,
        'content-type': 'application/json',
      },
      body,
      signal: AbortSignal.timeout(startupTimeoutMs),
    });
    const responseText = await response.text();
    if (!response.ok) {
      throw new Error(`D1 remote batch failed with HTTP ${response.status}: ${responseText.slice(0, 2000)}`);
    }
    const result = JSON.parse(responseText);
    if (result.ok !== true || result.count !== statements.length) {
      throw new Error('D1 remote batch returned an invalid completion summary.');
    }
    return {
      ok: true,
      statementCount: statements.length,
      changes: Number(result.changes || 0),
      workerName,
    };
  } finally {
    stopProcess(child);
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
}

async function main() {
  const inputIndex = process.argv.indexOf('--input');
  const inputPath = inputIndex >= 0 ? process.argv[inputIndex + 1] : undefined;
  if (!inputPath) throw new Error('Usage: run-d1-remote-batch.cjs --input <private-json-file>');
  const input = JSON.parse(fs.readFileSync(path.resolve(inputPath), 'utf8'));
  const result = await executeD1RemoteBatch(input);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

module.exports = {
  buildRemoteBatchWorkerSource,
  executeD1RemoteBatch,
  normalizeBatchStatements,
  sha256,
  splitSqlStatements,
};
