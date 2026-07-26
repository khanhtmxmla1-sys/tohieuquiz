import { useCallback, useEffect, useRef, useState } from 'react';
import type { PracticeTopicSummary } from '../../../components/HomePage/student-dashboard/dashboard.types';
import { practiceService } from '../../../services/practiceService';

export const usePracticeTopics = () => {
  const [topics, setTopics] = useState<PracticeTopicSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const retry = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const nextTopics = await practiceService.getTopics();
      if (requestId === requestIdRef.current) {
        setTopics(nextTopics);
      }
    } catch {
      if (requestId === requestIdRef.current) {
        setErrorMessage('Chưa tải được thư viện luyện tập.');
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void retry();
    return () => {
      requestIdRef.current += 1;
    };
  }, [retry]);

  return { topics, isLoading, errorMessage, retry };
};

export type PracticeTopicsController = ReturnType<typeof usePracticeTopics>;

