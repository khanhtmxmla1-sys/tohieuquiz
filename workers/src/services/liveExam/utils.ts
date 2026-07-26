import type {
  LiveExamParticipant,
  LiveExamSession,
  LiveExamStatus,
} from '../../../../src/types/liveExam.types';

export function generateAccessCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function now(): string {
  return new Date().toISOString();
}

export function calculateEndTime(startedAt: string, durationMinutes: number): string {
  const start = new Date(startedAt);
  start.setMinutes(start.getMinutes() + durationMinutes);
  return start.toISOString();
}

export function getChangedRows(result: unknown): number {
  const candidate = result as any;
  return Number(candidate?.meta?.changes ?? candidate?.changes ?? 0);
}

export function mapSessionRow(row: any): LiveExamSession & { chatEnabled?: boolean } {
  return {
    id: String(row.id),
    title: String(row.title),
    quizId: String(row.quiz_id),
    quizTitle: row.quiz_title ? String(row.quiz_title) : undefined,
    teacherId: String(row.teacher_id),
    classId: String(row.class_id || ''),
    className: row.class_name ? String(row.class_name) : undefined,
    participantCount: row.participant_count === undefined ? undefined : Number(row.participant_count),
    submittedCount: row.submitted_count === undefined ? undefined : Number(row.submitted_count),
    averageScore: row.average_score === null || row.average_score === undefined
      ? undefined
      : Number(row.average_score),
    duration: Number(row.duration),
    scheduledAt: row.scheduled_at || undefined,
    startedAt: row.started_at || undefined,
    endsAt: row.ends_at || undefined,
    closedAt: row.closed_at || undefined,
    settings: row.settings ? JSON.parse(String(row.settings)) : {},
    status: row.status as LiveExamStatus,
    accessCode: String(row.access_code),
    chatEnabled: Boolean(row.chat_enabled ?? 1),
    archivedAt: row.archived_at || undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function mapParticipantRow(row: any): LiveExamParticipant {
  return {
    id: row.id,
    liveExamId: row.live_exam_id,
    studentId: row.student_id,
    username: row.username,
    joinedAt: row.joined_at,
    startedAt: row.started_at || undefined,
    submittedAt: row.submitted_at || undefined,
    answers: row.answers ? JSON.parse(row.answers) : undefined,
    score: row.score || undefined,
    correctCount: row.correct_count || undefined,
    wrongCount: row.wrong_count || undefined,
    rank: row.rank || undefined,
    tabSwitches: row.tab_switches || 0,
    warnings: row.warnings ? JSON.parse(row.warnings) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
