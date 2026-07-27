import { expect, vi } from 'vitest';

type ExpectedConsoleSpy = {
  mock: {
    calls: unknown[][];
  };
};

export const expectConsoleError = () => (
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
);

export const expectConsoleWarn = () => (
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
);

export const expectConsoleMessage = (
  spy: ExpectedConsoleSpy,
  fragment: string,
) => {
  expect(spy).toHaveBeenCalled();
  const rendered = spy.mock.calls
    .flat()
    .map((value) => value instanceof Error ? `${value.name}: ${value.message}` : String(value))
    .join(' ');
  expect(rendered).toContain(fragment);
};
