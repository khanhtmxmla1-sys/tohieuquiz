import { useEffect, useState } from 'react';
import {
  readDeviceCapabilities,
  type CapabilityNavigator,
  type DeviceCapabilities,
} from '../config/deviceCapabilities';

const snapshotsEqual = (left: DeviceCapabilities, right: DeviceCapabilities): boolean => (
  left.prefersReducedMotion === right.prefersReducedMotion
  && left.saveData === right.saveData
  && left.effectiveType === right.effectiveType
  && left.deviceMemoryGb === right.deviceMemoryGb
  && left.hardwareConcurrency === right.hardwareConcurrency
  && left.online === right.online
);

export const useReducedExperience = (): DeviceCapabilities => {
  const [snapshot, setSnapshot] = useState<DeviceCapabilities>(readDeviceCapabilities);

  useEffect(() => {
    const update = () => {
      const next = readDeviceCapabilities();
      setSnapshot((current) => (snapshotsEqual(current, next) ? current : next));
    };
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const connection = (navigator as CapabilityNavigator).connection;

    media?.addEventListener?.('change', update);
    connection?.addEventListener?.('change', update);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();

    return () => {
      media?.removeEventListener?.('change', update);
      connection?.removeEventListener?.('change', update);
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return snapshot;
};

export default useReducedExperience;
