import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('notification ticker stylesheet entrypoint', () => {
  it('includes the ticker animation stylesheet in the production CSS graph', () => {
    const appStyles = readFileSync(resolve(process.cwd(), 'styles.css'), 'utf8');

    expect(appStyles).toContain('@import "./styles/animations.css";');
  });
});
