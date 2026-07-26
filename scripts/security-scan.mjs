import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { extname, basename } from 'node:path';

const textExtensions = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.jsonc', '.md',
  '.txt', '.yaml', '.yml', '.toml', '.env', '.example', '.sql', '.csv',
  '.html', '.css', '.xml', '.ps1', '.sh',
]);

const tracked = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  { encoding: 'utf8' },
).split('\0').filter(Boolean).filter((file) => existsSync(file));

const findings = [];
const report = (file, line, rule, detail) => findings.push({ file, line, rule, detail });
const lineNumber = (text, offset) => text.slice(0, offset).split('\n').length;
const normalized = (file) => file.replaceAll('\\', '/');

for (const rawFile of tracked) {
  const file = normalized(rawFile);
  const name = basename(file);
  const lower = file.toLowerCase();

  if ((name === '.env' || name.startsWith('.env.')) && name !== '.env.example') {
    report(file, 1, 'tracked-environment-file', 'Only .env.example may be committed.');
  }
  if (name.startsWith('.dev.vars') && name !== '.dev.vars.example') {
    report(file, 1, 'tracked-worker-secret-file', 'Only .dev.vars.example may be committed.');
  }
  if (lower.startsWith('data/migration/') && lower !== 'data/migration/readme.md') {
    report(file, 1, 'tracked-data-export', 'Migration exports must remain local.');
  }
  if (lower.startsWith('workers/data/') && lower !== 'workers/data/readme.md') {
    report(file, 1, 'tracked-data-export', 'Generated D1 seed exports must remain local.');
  }
  if (/^workers\/(?:dump[^/]*\.json|[^/]*query[^/]*\.txt|fix_[^/]*\.ps1)$/i.test(file)) {
    report(file, 1, 'tracked-operational-artifact', 'Worker query dumps and one-off repair scripts must remain local.');
  }
  if (/\.(?:pem|key|p12|pfx|keystore)$/i.test(file)) {
    report(file, 1, 'tracked-private-key-file', 'Private key/certificate material is forbidden.');
  }
  if (/\.qwen\/settings.*\.corrupted/i.test(file)) {
    report(file, 1, 'tracked-corrupted-agent-config', 'Corrupted agent config can contain credentials.');
  }

  if (statSync(rawFile).size > 5_000_000) continue;
  if (!textExtensions.has(extname(file).toLowerCase()) && !name.startsWith('.env') && !name.startsWith('.dev.vars')) continue;

  const text = readFileSync(rawFile, 'utf8');
  const patterns = [
    ['private-key-literal', /-----BEGIN [A-Z ]*PRIVATE KEY-----/g],
    ['openai-style-secret', /\bsk-[A-Za-z0-9@._-]{12,}\b/g],
    ['google-api-key', /\bAIza[0-9A-Za-z_-]{20,}\b/g],
    ['github-token', /\bgh[pousr]_[0-9A-Za-z]{20,}\b/g],
    ['aws-access-key', /\bAKIA[0-9A-Z]{16}\b/g],
    ['slack-token', /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/g],
    ['stripe-live-secret', /\b(?:sk|rk)_live_[0-9A-Za-z]{12,}\b/g],
    ['jwt-literal', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g],
    ['credential-in-url', /https?:\/\/[^\s/@:]+:[^\s/@]+@[^\s/]+/g],
  ];

  const isTestOrFixture = /(?:^|\/)(?:tests?|__tests__|fixtures)(?:\/|$)/.test(file)
    || /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file);
  const labeledCredential = isTestOrFixture
    ? /$a/g
    : /\b(?:api[_ -]?(?:key|secret)|secret|token)\b[^\r\nA-Za-z0-9]{0,12}([A-Za-z0-9_.-]{24,})/gi;
  for (const match of text.matchAll(labeledCredential)) {
    const value = match[1].trim();
    if (/^(?:example|placeholder|changeme|your_|test|dummy|redacted|<|\$\{|process\.env)/i.test(value)) continue;
    report(file, lineNumber(text, match.index ?? 0), 'labeled-credential-literal', 'Credential-like literal follows a secret/token/key label. Value hidden.');
  }

  if (/\.(?:md|txt)$/i.test(file) && /(?:deployment|guide|checklist)/i.test(name)) {
    for (const match of text.matchAll(/^\s*#?\s*[A-Fa-f0-9]{60,80}\s*$/gm)) {
      report(file, lineNumber(text, match.index ?? 0), 'long-hex-credential-literal', 'Long hexadecimal credential-like literal in deployment documentation. Value hidden.');
    }
  }

  for (const [rule, pattern] of patterns) {
    for (const match of text.matchAll(pattern)) {
      report(file, lineNumber(text, match.index ?? 0), rule, 'High-confidence secret literal. Value hidden.');
    }
  }

  const isClientCode = /^(?:src|public)\//.test(file)
    || file === 'vite.config.ts'
    || file === 'vercel.json'
    || file === '.env.example';
  if (isClientCode) {
    for (const match of text.matchAll(/\bVITE_[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD)[A-Z0-9_]*\b/g)) {
      report(file, lineNumber(text, match.index ?? 0), 'client-secret-variable', 'Secret-like VITE_* variables are bundled into browser JavaScript.');
    }
  }

  const isExecutableSource = /^(?:src|workers|scripts)\//.test(file)
    && !/(?:^|\/)(?:tests?|__tests__|fixtures)(?:\/|$)/.test(file)
    && !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file);
  if (isExecutableSource) {
    if (/^src\//.test(file) && file !== 'src/services/api/auth.ts') {
      for (const match of text.matchAll(/(?:itongquiz|tohieuquiz)_(?:teacher_)?jwt_token|(?:auth-storage|student_session)[^\r\n]{0,120}(?:state\??\.?token|\.token)/g)) {
        report(file, lineNumber(text, match.index ?? 0), 'browser-jwt-storage', 'Browser-readable JWT storage is forbidden; use the HttpOnly session cookie.');
      }
      for (const match of text.matchAll(/Authorization\s*[:=][^\r\n]{0,80}Bearer/g)) {
        report(file, lineNumber(text, match.index ?? 0), 'browser-bearer-session', 'Browser session requests must use credentials: include instead of a readable bearer token.');
      }
    }

    const assignment = /(?:^|[^\w])\$?(email|username|user|pass|password|passwd|pwd|api[_-]?key|api[_-]?secret|secret|token)\s*=\s*(['"])([^'"\r\n]{4,})\2/gim;
    for (const match of text.matchAll(assignment)) {
      const field = match[1];
      const value = match[3].trim();
      if (/^(?:example|placeholder|changeme|your_|test|dummy|redacted|<|\$\{|process\.env|env:)/i.test(value)) continue;
      if (/^(?:api[_-]?(?:key|secret)|secret|token)$/i.test(field) && value.length < 20) continue;
      report(file, lineNumber(text, match.index ?? 0), 'hardcoded-credential', `Hardcoded ${field} literal. Value hidden.`);
    }
  }

  if (extname(file).toLowerCase() === '.csv') {
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length > 1) {
      const header = lines[0].toLowerCase();
      if (/(password|passwordhash|parentphone|phone|email|fullname|student name)/.test(header)) {
        report(file, 1, 'sensitive-csv-data', 'CSV contains sensitive columns and committed data rows.');
      }
    }
  }
}

if (findings.length > 0) {
  console.error(`Security scan failed with ${findings.length} finding(s):`);
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} [${finding.rule}] ${finding.detail}`);
  }
  process.exit(1);
}

process.stdout.write(`Security scan passed: ${tracked.length} tracked/unignored files checked.\n`);
