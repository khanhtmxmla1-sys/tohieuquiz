import { useCallback, useEffect, useState } from 'react';

const readSearchParams = (): URLSearchParams => (
  typeof window === 'undefined'
    ? new URLSearchParams()
    : new URLSearchParams(window.location.search)
);

export function useBrowserSearchParams(): [URLSearchParams, (next: URLSearchParams) => void] {
  const [searchParams, setSearchParamsState] = useState<URLSearchParams>(readSearchParams);

  useEffect(() => {
    const syncFromLocation = () => setSearchParamsState(readSearchParams());
    window.addEventListener('popstate', syncFromLocation);
    return () => window.removeEventListener('popstate', syncFromLocation);
  }, []);

  const setSearchParams = useCallback((next: URLSearchParams) => {
    const query = next.toString();
    const url = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    window.history.replaceState(window.history.state, '', url);
    setSearchParamsState(new URLSearchParams(next));
  }, []);

  return [searchParams, setSearchParams];
}
