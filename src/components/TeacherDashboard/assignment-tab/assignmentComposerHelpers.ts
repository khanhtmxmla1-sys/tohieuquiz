import type { Quiz } from '../../../types';
import type { SmartAssignmentRecommendedQuiz } from '../../../types/classroom.types';
import { getVietnamDefaultDeadline } from '../../../utils/dateTime';

export const getDefaultDeadline = (): string => getVietnamDefaultDeadline();

export const orderAssignmentQuizzes = (
  quizzes: Quiz[],
  recommendations?: SmartAssignmentRecommendedQuiz[],
): Quiz[] => {
  if (!recommendations?.length) return quizzes;
  const order = new Map(recommendations.map((quiz, index) => [quiz.quizId, index]));
  return [...quizzes].sort((left, right) => {
    const leftOrder = order.get(left.id);
    const rightOrder = order.get(right.id);
    if (leftOrder !== undefined && rightOrder !== undefined) return leftOrder - rightOrder;
    if (leftOrder !== undefined) return -1;
    if (rightOrder !== undefined) return 1;
    return left.title.localeCompare(right.title);
  });
};

export const getTagsFallbackMessage = (recommendation?: SmartAssignmentRecommendedQuiz): string => {
  const explicitMatch = Boolean(
    recommendation?.matchBreakdown.subskillMatched || recommendation?.matchBreakdown.skillMatched,
  );
  return explicitMatch
    ? 'He thong van co khop ky nang, nhung mot phan diem de xuat dang duoc bo tro boi tags cu. Neu thay co muon chac hon, hay xem nhanh vai cau dau truoc khi giao bai.'
    : 'Question bank hien chua co metadata ky nang day du cho de nay. He thong dang suy luan chu yeu tu tags cu, vi vay thay co nen xem nhanh 2-3 cau dau truoc khi giao bai.';
};
