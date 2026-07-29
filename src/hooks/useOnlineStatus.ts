import { useEffect, useState } from 'react';

export interface OnlineStatusSnapshot {
  isOnline: boolean;
  lastChangedAt: number;
}

const readOnlineStatus = (): boolean => (
  typeof navigator === 'undefined' ? true : navigator.onLine !== false
);

export const useOnlineStatus = (): OnlineStatusSnapshot => {
  const [snapshot, setSnapshot] = useState<OnlineStatusSnapshot>(() => ({
    isOnline: readOnlineStatus(),
    lastChangedAt: Date.now(),
  }));

  useEffect(() => {
    const update = () => {
      const isOnline = readOnlineStatus();
      setSnapshot((current) => (
        current.isOnline === isOnline
          ? current
          : { isOnline, lastChangedAt: Date.now() }
      ));
    };

    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();

    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return snapshot;
};

export default useOnlineStatus;
