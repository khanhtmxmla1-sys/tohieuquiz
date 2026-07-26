import type { BatchStudentRow, QuizOption, ResultRecord, StudentOption } from './types';

export const defaultCertificateDateLine = (): string => {
  const now = new Date();
  return `Mường La, ngày ${now.getDate()} tháng ${now.getMonth() + 1} năm ${now.getFullYear()}`;
};

export const mergeStudentsWithResults = (
  students: StudentOption[],
  results: ResultRecord[],
  quizId: string,
  quizzes: QuizOption[],
): BatchStudentRow[] => students.map(student => {
  const result = results.find(item => (
    item['Student Name']?.trim().toLowerCase() === student.fullName?.trim().toLowerCase()
  ));
  return {
    ...student,
    score: result?.['Score'] ?? null,
    quizTitle: result?.['Quiz Title'] ?? quizzes.find(quiz => quiz.id === quizId)?.title ?? null,
  };
});

export const filterBatchStudents = (rows: BatchStudentRow[], search: string): BatchStudentRow[] => {
  const query = search.toLowerCase();
  return rows.filter(row => (
    row.fullName.toLowerCase().includes(query) || row.username.toLowerCase().includes(query)
  ));
};
