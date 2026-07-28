export type EffectiveConnectionType = 'slow-2g' | '2g' | '3g' | '4g' | 'unknown';

export type ReducedExperienceReason =
  | 'reduced-motion'
  | 'save-data'
  | 'slow-connection'
  | 'low-memory'
  | 'low-cpu'
  | 'offline';

export interface DeviceCapabilityInput {
  prefersReducedMotion: boolean;
  saveData: boolean;
  effectiveType: EffectiveConnectionType;
  deviceMemoryGb?: number;
  hardwareConcurrency?: number;
  online: boolean;
}

export interface DeviceCapabilities extends DeviceCapabilityInput {
  reduceMotion: boolean;
  reduceData: boolean;
  reduceVisuals: boolean;
  shouldLoadRichMedia: boolean;
  reasons: ReducedExperienceReason[];
}

interface NavigatorWithCapabilities extends Navigator {
  connection?: {
    saveData?: boolean;
    effectiveType?: string;
    addEventListener?: (type: 'change', listener: EventListener) => void;
    removeEventListener?: (type: 'change', listener: EventListener) => void;
  };
  deviceMemory?: number;
}

const normalizeEffectiveType = (value: unknown): EffectiveConnectionType => {
  if (value === 'slow-2g' || value === '2g' || value === '3g' || value === '4g') return value;
  return 'unknown';
};

export const evaluateDeviceCapabilities = (
  input: DeviceCapabilityInput,
): DeviceCapabilities => {
  const reasons: ReducedExperienceReason[] = [];
  if (input.prefersReducedMotion) reasons.push('reduced-motion');
  if (input.saveData) reasons.push('save-data');
  if (input.effectiveType === 'slow-2g' || input.effectiveType === '2g' || input.effectiveType === '3g') {
    reasons.push('slow-connection');
  }
  if (typeof input.deviceMemoryGb === 'number' && input.deviceMemoryGb <= 2) reasons.push('low-memory');
  if (typeof input.hardwareConcurrency === 'number' && input.hardwareConcurrency <= 2) reasons.push('low-cpu');
  if (!input.online) reasons.push('offline');

  const reduceMotion = input.prefersReducedMotion;
  const reduceData = input.saveData
    || input.effectiveType === 'slow-2g'
    || input.effectiveType === '2g'
    || input.effectiveType === '3g'
    || !input.online;
  const reduceVisuals = reasons.length > 0;

  return {
    ...input,
    reduceMotion,
    reduceData,
    reduceVisuals,
    shouldLoadRichMedia: !reduceVisuals,
    reasons,
  };
};

export const readDeviceCapabilityInput = (): DeviceCapabilityInput => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      prefersReducedMotion: false,
      saveData: false,
      effectiveType: 'unknown',
      online: true,
    };
  }

  const capableNavigator = navigator as NavigatorWithCapabilities;
  return {
    prefersReducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    saveData: capableNavigator.connection?.saveData === true,
    effectiveType: normalizeEffectiveType(capableNavigator.connection?.effectiveType),
    deviceMemoryGb: capableNavigator.deviceMemory,
    hardwareConcurrency: capableNavigator.hardwareConcurrency,
    online: capableNavigator.onLine !== false,
  };
};

export const readDeviceCapabilities = (): DeviceCapabilities => (
  evaluateDeviceCapabilities(readDeviceCapabilityInput())
);

export type CapabilityNavigator = NavigatorWithCapabilities;
