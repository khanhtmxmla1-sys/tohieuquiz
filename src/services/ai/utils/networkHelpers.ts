/**
 * @module networkHelpers
 * Network utility functions for AI provider routing.
 * Determines whether to use dev proxy, local vs remote URLs, etc.
 */

export const shouldUseCliproxyDevProxy = (url: string): boolean => {
  if (!(import.meta as any).env.DEV || typeof window === 'undefined') {
    return false;
  }

  try {
    const parsed = new URL(url, window.location.origin);
    const hostname = parsed.hostname.toLowerCase();
    return parsed.port === '3000' || hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return url.includes(':3000') || url.includes('localhost') || url.includes('127.0.0.1');
  }
};

export const shouldTreatAsLocalUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    const hostname = parsed.hostname.toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return url.includes('localhost') || url.includes('127.0.0.1');
  }
};

export const isBrowserOnLocalhost = (): boolean => {
  if (typeof window === 'undefined') return true;
  const hostname = window.location.hostname.toLowerCase();
  return hostname === 'localhost' || hostname === '127.0.0.1';
};

export const resolvePublicProviderBaseUrl = (configuredUrl: string, publicFallback: string): string => {
  if (!configuredUrl) return publicFallback;
  if (!isBrowserOnLocalhost() && shouldTreatAsLocalUrl(configuredUrl)) {
    return publicFallback;
  }
  return configuredUrl;
};

/**
 * Rewrite localhost/127.0.0.1 targets to the current browser hostname
 * so the request works when the app is accessed via an external IP address.
 */
export const resolveTargetUrl = (targetUrl: string): string => {
  if (
    (targetUrl.includes('localhost') || targetUrl.includes('127.0.0.1')) &&
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
  ) {
    return targetUrl
      .replace('localhost', window.location.hostname)
      .replace('127.0.0.1', window.location.hostname);
  }
  return targetUrl;
};

/** Convert a remote image URL to a base64-encoded data string. */
export async function urlToBase64(url: string): Promise<{ data: string; mimeType: string }> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);

  const blob = await response.blob();
  const mimeType = blob.type || 'image/jpeg';

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve({ data: base64Data, mimeType });
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Convert a File object to a base64 string (without the data: prefix). */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      resolve(base64String.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
