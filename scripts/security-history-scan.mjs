import { execFileSync } from 'node:child_process';

const history = execFileSync('git', [
  'log', '--all', '--no-color', '--format=commit:%H', '--patch', '--unified=0',
  '--', '.', ':(exclude)package-lock.json', ':(exclude)workers/package-lock.json',
], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

const patterns = [
  ['private-key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['openai-style-secret', /\bsk-[A-Za-z0-9@._-]{24,}\b/],
  ['github-token', /\bgh[pousr]_[0-9A-Za-z]{30,}\b/],
  ['google-api-key', /\bAIza[0-9A-Za-z_-]{30,}\b/],
  ['aws-access-key', /\bAKIA[0-9A-Z]{16}\b/],
  ['slack-token', /\bxox[baprs]-[0-9A-Za-z-]{20,}\b/],
];

const ignored = /(?:example|placeholder|dummy|redacted|changeme|your[_-]|test[_-]?token|pattern|regex)/i;
const findings = new Set();
let commit = 'unknown';
for (const line of history.split(/\r?\n/)) {
  if (line.startsWith('commit:')) {
    commit = line.slice('commit:'.length, 'commit:'.length + 12);
    continue;
  }
  if (!line.startsWith('+') || line.startsWith('+++')) continue;
  const added = line.slice(1);
  if (ignored.test(added) || /security-(?:scan|history-scan)/.test(added)) continue;
  for (const [rule, pattern] of patterns) {
    if (pattern.test(added)) findings.add(`${commit}:${rule}`);
  }
}

if (findings.size > 0) {
  console.error(`Git history secret scan failed with ${findings.size} high-confidence finding(s):`);
  for (const finding of findings) console.error(`- ${finding} (value hidden)`);
  process.exit(1);
}

console.log('Git history secret scan passed: all reachable commits checked.');
