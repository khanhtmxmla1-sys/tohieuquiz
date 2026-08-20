'use strict';

const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : Number.NaN;
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function certifyCapacityReport(report) {
  const summary = report && report.summary ? report.summary : {};
  const failures = [];
  const statusP95 = finiteNumber(summary.statusP95Ms);
  const submitP95 = finiteNumber(summary.submitP95Ms);
  const concurrency = finiteNumber(summary.concurrency);
  const zeroGates = [
    ['lostAnswers', summary.lostAnswers],
    ['duplicateFailures', summary.duplicateFailures],
    ['d1Overload', summary.d1OverloadErrors],
    ['app5xx', summary.app5xx],
    ['networkErrors', summary.networkErrors],
  ];

  if (!Number.isInteger(concurrency) || concurrency <= 0) failures.push('concurrency must be a positive integer');
  if (!(statusP95 >= 0 && statusP95 < 500)) failures.push('statusP95 must be <500ms');
  if (!(submitP95 >= 0 && submitP95 < 2000)) failures.push('submitP95 must be <2000ms');
  for (const [name, value] of zeroGates) {
    if (finiteNumber(value) !== 0) failures.push(`${name} must equal 0`);
  }

  const benchmarkRunId = report && report.benchmarkRunId;
  const buildSha = report && report.build && report.build.sha;
  const runtimeConfigVersion = report && report.config && report.config.runtimeConfigVersion;
  const pollingProfileVersion = report && report.polling && report.polling.profileVersion;
  for (const [name, value] of [
    ['benchmarkRunId', benchmarkRunId],
    ['buildSha', buildSha],
    ['runtimeConfigVersion', runtimeConfigVersion],
    ['pollingProfileVersion', pollingProfileVersion],
  ]) {
    if (!nonEmpty(value) || /^(?:unspecified|replace-with)/i.test(String(value).trim())) {
      failures.push(`${name} is required and must identify the benchmark environment`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`CAPACITY_CERTIFICATION_FAILED: ${failures.join('; ')}`);
  }

  const passedAt = new Date().toISOString();
  return {
    profileId: `live-capacity-${randomUUID()}`,
    benchmarkRunId: String(benchmarkRunId).trim(),
    buildSha: String(buildSha).trim(),
    runtimeConfigVersion: String(runtimeConfigVersion).trim(),
    pollingProfileVersion: String(pollingProfileVersion).trim(),
    certifiedConcurrentStudents: concurrency,
    statusP95Ms: statusP95,
    submitP95Ms: submitP95,
    lostAnswers: 0,
    duplicateFailures: 0,
    d1Overload: 0,
    app5xx: 0,
    networkErrors: 0,
    status: 'CERTIFIED',
    passedAt,
    createdAt: passedAt,
  };
}

function inputPath(argv) {
  const inputIndex = argv.indexOf('--input');
  if (inputIndex >= 0) return argv[inputIndex + 1];
  return argv[0];
}

if (require.main === module) {
  try {
    const path = inputPath(process.argv.slice(2));
    if (!path) throw new Error('Usage: npm run capacity:certify -- --input <benchmark-report.json>');
    const report = JSON.parse(readFileSync(resolve(path), 'utf8'));
    process.stdout.write(`${JSON.stringify(certifyCapacityReport(report), null, 2)}\n`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

module.exports = { certifyCapacityReport };
