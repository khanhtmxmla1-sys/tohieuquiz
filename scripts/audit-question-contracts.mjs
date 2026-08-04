#!/usr/bin/env node

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runQuestionContractAudit } from './audit-question-contracts-core.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);

if (resolve(process.argv[1] ?? '') === SCRIPT_PATH) {
  runQuestionContractAudit().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
