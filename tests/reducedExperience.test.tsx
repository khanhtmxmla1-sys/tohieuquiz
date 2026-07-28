import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  evaluateDeviceCapabilities,
  type DeviceCapabilityInput,
} from '../src/config/deviceCapabilities';
import { useReducedExperience } from '../src/hooks/useReducedExperience';

const capableInput = (overrides: Partial<DeviceCapabilityInput> = {}): DeviceCapabilityInput => ({
  prefersReducedMotion: false,
  saveData: false,
  effectiveType: '4g',
  deviceMemoryGb: 8,
  hardwareConcurrency: 8,
  online: true,
  ...overrides,
});

describe('device capability policy', () => {
  it('uses the full experience on a capable device and connection', () => {
    expect(evaluateDeviceCapabilities(capableInput())).toMatchObject({
      reduceMotion: false,
      reduceData: false,
      reduceVisuals: false,
      shouldLoadRichMedia: true,
      reasons: [],
    });
  });

  it.each([
    ['reduced motion', { prefersReducedMotion: true }],
    ['data saver', { saveData: true }],
    ['slow connection', { effectiveType: '2g' as const }],
    ['low memory', { deviceMemoryGb: 1 }],
    ['few CPU cores', { hardwareConcurrency: 2 }],
    ['offline', { online: false }],
  ])('reduces rich visual work for %s', (_label, override) => {
    const result = evaluateDeviceCapabilities(capableInput(override));
    expect(result.reduceVisuals).toBe(true);
    expect(result.shouldLoadRichMedia).toBe(false);
    expect(result.reasons.length).toBeGreaterThan(0);
  });
});

describe('useReducedExperience', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reacts to media and connection changes', () => {
    const mediaListeners = new Set<() => void>();
    const connectionListeners = new Set<() => void>();
    let reducedMotion = false;
    const connection = {
      saveData: false,
      effectiveType: '4g',
      addEventListener: (_event: string, listener: () => void) => connectionListeners.add(listener),
      removeEventListener: (_event: string, listener: () => void) => connectionListeners.delete(listener),
    };
    const matchMedia = vi.fn(() => ({
      get matches() { return reducedMotion; },
      addEventListener: (_event: string, listener: () => void) => mediaListeners.add(listener),
      removeEventListener: (_event: string, listener: () => void) => mediaListeners.delete(listener),
    }));

    Object.defineProperty(window, 'matchMedia', { configurable: true, value: matchMedia });
    Object.defineProperty(navigator, 'connection', { configurable: true, value: connection });
    Object.defineProperty(navigator, 'deviceMemory', { configurable: true, value: 8 });
    Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, value: 8 });
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });

    const { result } = renderHook(() => useReducedExperience());
    expect(result.current.reduceVisuals).toBe(false);

    act(() => {
      reducedMotion = true;
      mediaListeners.forEach((listener) => listener());
    });
    expect(result.current.reduceMotion).toBe(true);
    expect(result.current.shouldLoadRichMedia).toBe(false);

    act(() => {
      reducedMotion = false;
      connection.saveData = true;
      connectionListeners.forEach((listener) => listener());
    });
    expect(result.current.reduceData).toBe(true);
    expect(result.current.shouldLoadRichMedia).toBe(false);
  });
});
