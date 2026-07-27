import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const shardCount = Number.parseInt(process.env.VITEST_SHARD_COUNT || '4', 10);
if (!Number.isInteger(shardCount) || shardCount < 1) {
  console.error('VITEST_SHARD_COUNT must be a positive integer.');
  process.exit(1);
}

const vitestEntry = fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url));

for (let shard = 1; shard <= shardCount; shard += 1) {
  console.log(`\n[verify] Running Vitest shard ${shard}/${shardCount}`);
  const result = spawnSync(
    process.execPath,
    [
      vitestEntry,
      'run',
      '--maxWorkers=2',
      `--shard=${shard}/${shardCount}`,
      '--reporter=dot',
    ],
    {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit',
    },
  );

  if (result.error) {
    console.error(`[verify] Unable to start Vitest shard ${shard}/${shardCount}:`, result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`[verify] Vitest shard ${shard}/${shardCount} failed with exit code ${result.status ?? 'unknown'}.`);
    process.exit(result.status ?? 1);
  }
}

console.log(`\n[verify] All ${shardCount} Vitest shards passed.`);
