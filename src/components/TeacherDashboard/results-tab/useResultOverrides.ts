import { useEffect, useState } from 'react';
import type { Quiz, StudentResult } from '../../../types';
import { fetchResultAnswers } from '../../../services/results/resultAnswersService';
import { calculateOverrideFromAnswers } from './resultAnswerOverride';
import type { ResultDisplayOverride } from './types';

export const useResultOverrides = (paginatedResults: StudentResult[], quizzes: Quiz[]) => {
  const [resultOverrides, setResultOverrides] = useState<Record<string, ResultDisplayOverride>>({});

  useEffect(() => {
    if (paginatedResults.length === 0) return;
    let cancelled = false;

    Promise.all(paginatedResults.map(async result => {
      try {
        const answers = await fetchResultAnswers(result.id);
        const quiz = quizzes.find(item => String(item.id) === String(result.quizId));
        const override = calculateOverrideFromAnswers(result, answers, quiz);
        return override ? { id: String(result.id), override } : null;
      } catch {
        return null;
      }
    })).then(resolved => {
      if (cancelled) return;
      setResultOverrides(previous => {
        let changed = false;
        const next = { ...previous };
        resolved.forEach(item => {
          if (!item) return;
          const existing = next[item.id];
          if (!existing
            || existing.correctCount !== item.override.correctCount
            || existing.totalQuestions !== item.override.totalQuestions
            || existing.score !== item.override.score) {
            next[item.id] = item.override;
            changed = true;
          }
        });
        return changed ? next : previous;
      });
    });

    return () => { cancelled = true; };
  }, [paginatedResults, quizzes]);

  return resultOverrides;
};
