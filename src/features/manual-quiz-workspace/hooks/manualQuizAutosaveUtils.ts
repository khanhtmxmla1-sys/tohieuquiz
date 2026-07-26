export const browserIsOnline = (): boolean =>
    typeof navigator === 'undefined' || navigator.onLine !== false;
