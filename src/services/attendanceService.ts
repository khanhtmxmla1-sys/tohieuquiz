import { callApi } from './apiAdapter';
import type { QuestionRichTextEnvelopeV1 } from '../../shared/question-rich-text.contract';

export interface ClassAttendanceQuestion {
  id: string;
  subject: string;
  question: string;
  questionRichText?: QuestionRichTextEnvelopeV1;
  options: string[];
  correctAnswer: string;
  image: string;
  imageAlt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClassAttendanceSummary {
  enabled: boolean;
  questions: ClassAttendanceQuestion[];
  stats: {
    totalStudents: number;
    claimedToday: number;
  };
}

export interface AttendanceQuestionInput {
  subject?: string;
  question: string;
  questionRichText?: QuestionRichTextEnvelopeV1;
  options: string[];
  correctAnswer: string;
  image?: string;
  imageAlt?: string;
}

interface AttendanceApiResponse<T> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
}

const requireData = <T>(response: AttendanceApiResponse<T>, fallback: string): T => {
  if (response.status === 'success' && response.data) return response.data;
  throw new Error(response.message || fallback);
};

export const getClassAttendance = async (classId: string): Promise<ClassAttendanceSummary> => {
  const response = await callApi<AttendanceApiResponse<ClassAttendanceSummary>>(
    'get_class_attendance',
    { classId },
  );
  return requireData(response, 'Không thể tải câu hỏi điểm danh.');
};

export const setClassAttendanceEnabled = async (
  classId: string,
  enabled: boolean,
): Promise<ClassAttendanceSummary> => {
  const response = await callApi<AttendanceApiResponse<ClassAttendanceSummary>>(
    'set_class_attendance',
    { classId, enabled },
  );
  return requireData(response, 'Không thể cập nhật trạng thái điểm danh.');
};

export const createClassAttendanceQuestion = async (
  classId: string,
  input: AttendanceQuestionInput,
): Promise<ClassAttendanceQuestion> => {
  const response = await callApi<AttendanceApiResponse<ClassAttendanceQuestion>>(
    'create_class_attendance_question',
    { classId, ...input },
  );
  return requireData(response, 'Không thể tạo câu hỏi điểm danh.');
};

export const updateClassAttendanceQuestion = async (
  classId: string,
  questionId: string,
  input: AttendanceQuestionInput,
): Promise<ClassAttendanceQuestion> => {
  const response = await callApi<AttendanceApiResponse<ClassAttendanceQuestion>>(
    'update_class_attendance_question',
    { classId, questionId, ...input },
  );
  return requireData(response, 'Không thể cập nhật câu hỏi điểm danh.');
};

export const deleteClassAttendanceQuestion = async (
  classId: string,
  questionId: string,
): Promise<ClassAttendanceSummary> => {
  const response = await callApi<AttendanceApiResponse<ClassAttendanceSummary>>(
    'delete_class_attendance_question',
    { classId, questionId },
  );
  return requireData(response, 'Không thể xóa câu hỏi điểm danh.');
};
