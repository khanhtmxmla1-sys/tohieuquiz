import { StudentResult, QuestionType, Question } from '../types';

/**
 * Interface cho dữ liệu biểu đồ Radar
 */
export interface CompetencyData {
  subject: string;   // Tên năng lực (ví dụ: "Đọc hiểu")
  score: number;     // Điểm số 0-100
  fullMark: number;  // Luôn là 100
  count: number;     // Số câu hỏi thuộc lĩnh vực này
}

/**
 * Định nghĩa 5 trục năng lực chính cho học sinh Tiểu học
 */
export enum CompetencyDimension {
  RECOGNITION = 'Ghi nhớ & Nhận biết',
  COMPREHENSION = 'Thông hiểu',
  APPLICATION = 'Vận dụng',
  LOGIC = 'Logic & Quan sát',
  CREATIVITY = 'Sáng tạo & Phân tích'
}

/**
 * Bản đồ ánh xạ từ QuestionType sang Năng lực
 */
const TYPE_TO_DIMENSION: Record<string, CompetencyDimension> = {
  [QuestionType.MCQ]: CompetencyDimension.RECOGNITION,
  [QuestionType.TRUE_FALSE]: CompetencyDimension.RECOGNITION,
  [QuestionType.IMAGE_QUESTION]: CompetencyDimension.RECOGNITION,
  
  [QuestionType.DRAG_DROP]: CompetencyDimension.COMPREHENSION,
  [QuestionType.CATEGORIZATION]: CompetencyDimension.COMPREHENSION,
  [QuestionType.DROPDOWN]: CompetencyDimension.COMPREHENSION,
  
  [QuestionType.SHORT_ANSWER]: CompetencyDimension.APPLICATION,
  [QuestionType.MATCHING]: CompetencyDimension.APPLICATION,
  [QuestionType.MULTIPLE_SELECT]: CompetencyDimension.APPLICATION,
  
  [QuestionType.ORDERING]: CompetencyDimension.LOGIC,
  [QuestionType.ERROR_CORRECTION]: CompetencyDimension.LOGIC,
  [QuestionType.GEOMETRY]: CompetencyDimension.LOGIC,
  
  [QuestionType.RIDDLE]: CompetencyDimension.CREATIVITY,
  [QuestionType.WORD_SCRAMBLE]: CompetencyDimension.CREATIVITY,
  [QuestionType.UNDERLINE]: CompetencyDimension.COMPREHENSION,
};

/**
 * Tính toán điểm số năng lực từ kết quả bài làm
 */
export const calculateStudentCompetency = (
  result: StudentResult,
  questionsMap: Record<string, any> // Map chứa type của câu hỏi
): CompetencyData[] => {
  const dimensions = Object.values(CompetencyDimension);
  const stats: Record<string, { total: number; correct: number }> = {};

  // Khởi tạo stats
  dimensions.forEach(d => {
    stats[d] = { total: 0, correct: 0 };
  });

  // Duyệt qua từng câu hỏi trong bài làm
  const answers = result.answers || {};
  const validationDetails = result.validationDetails || [];

  Object.entries(answers).forEach(([qId, answerData]) => {
    if (qId.startsWith('_')) return; // Bỏ qua metadata

    // Xác định type của câu hỏi
    let qType: string | undefined;
    
    // Ưu tiên lấy từ questionsMap hoặc snapshot trong answerData
    if (questionsMap[qId]?.type) {
      qType = questionsMap[qId].type;
    } else if (typeof answerData === 'object' && answerData?.questionSnapshot?.type) {
      qType = answerData.questionSnapshot.type;
    }

    if (!qType) return;

    const dimension = TYPE_TO_DIMENSION[qType] || CompetencyDimension.COMPREHENSION;
    stats[dimension].total++;

    // Kiểm tra đúng/sai
    let isCorrect = false;
    if (typeof answerData === 'object' && typeof answerData?.isCorrect === 'boolean') {
      isCorrect = answerData.isCorrect;
    } else {
      const v = validationDetails.find(vd => vd.questionId === qId);
      if (v) isCorrect = v.isCorrect;
    }

    if (isCorrect) {
      stats[dimension].correct++;
    }
  });

  // Chuyển đổi sang format CompetencyData cho Radar Chart
  return dimensions.map(d => {
    const s = stats[d];
    const score = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
    
    return {
      subject: d,
      score: score,
      fullMark: 100,
      count: s.total
    };
  });
};
