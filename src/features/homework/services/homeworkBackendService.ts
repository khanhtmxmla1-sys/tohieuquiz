import { callApi } from '../../../services/apiAdapter';
import { HomeworkAssignment, HomeworkAssignmentAnalytics, HomeworkSubmission, AIResult } from '../types';

type ApiEnvelope<T> = { status: 'success' | 'error'; data: T; message?: string };

async function unwrap<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const response = await callApi<ApiEnvelope<T>>(action, payload);
  if (response.status !== 'success') throw new Error(response.message || 'Homework request failed');
  return response.data;
}

export const homeworkBackendService = {
  getAssignments(classId?: string) {
    return unwrap<HomeworkAssignment[]>('homework_list_student_assignments', classId ? { classId } : {});
  },
  getTeacherAssignments(_teacherId?: string, classId?: string) {
    return unwrap<HomeworkAssignment[]>('homework_list_teacher_assignments', classId ? { classId } : {});
  },
  async saveAssignment(assignment: Partial<HomeworkAssignment>): Promise<string> {
    const data = assignment.id
      ? await unwrap<{ id: string }>('homework_update_assignment', { ...assignment, assignmentId: assignment.id })
      : await unwrap<{ id: string }>('homework_create_assignment', assignment);
    return data.id;
  },
  archiveAssignment(assignmentId: string) {
    return unwrap<{ id: string; status: string }>('homework_archive_assignment', { assignmentId });
  },
  async deleteAssignment(assignmentId: string): Promise<void> {
    await this.archiveAssignment(assignmentId);
  },
  async submitHomework(submission: Partial<HomeworkSubmission> & { idempotencyKey?: string }): Promise<string> {
    const data = await unwrap<HomeworkSubmission>('homework_submit', {
      ...submission,
      assignmentId: submission.assignment_id,
      fileUrls: submission.file_urls,
      idempotencyKey: submission.idempotencyKey || submission.idempotency_key,
    });
    return data.id;
  },
  getSubmissions(assignmentId: string) {
    return unwrap<HomeworkSubmission[]>('homework_list_submissions', { assignmentId });
  },
  async getStudentSubmissions(assignmentId: string): Promise<HomeworkSubmission[]> {
    return unwrap<HomeworkSubmission[]>('homework_list_my_submissions', { assignmentId });
  },
  getAllMySubmissions(): Promise<HomeworkSubmission[]> {
    return unwrap<HomeworkSubmission[]>('homework_list_all_my_submissions');
  },
  async getStudentSubmission(assignmentId: string, _studentId?: string): Promise<HomeworkSubmission | null> {
    const rows = await this.getStudentSubmissions(assignmentId);
    return rows[0] || null;
  },
  async performOCR(mediaUrl: string): Promise<string> {
    const data = await unwrap<{ ocrText: string }>('homework_ocr', { mediaUrl });
    return data.ocrText;
  },
  requestAiSuggestion(submissionId: string) {
    return unwrap<AIResult>('homework_ai_suggestion', { submissionId });
  },
  publishGrade(submissionId: string, score: number, feedback: string, gradingBreakdown: unknown[] = []) {
    return unwrap<{ id: string; score: number; publishedAt: string }>('homework_publish_grade', {
      submissionId, score, feedback, gradingBreakdown,
    });
  },
  getAssignmentAnalytics(assignmentId: string) {
    return unwrap<HomeworkAssignmentAnalytics>('homework_assignment_analytics', { assignmentId });
  },
};
