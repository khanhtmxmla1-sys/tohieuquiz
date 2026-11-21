import type { D1Database } from '@cloudflare/workers-types';
import type { JWTPayload } from '../utils/jwt';
import { canAccessQuiz } from './quizOwnership';
import {
    PROTECTED_WORKFLOW_QUIZ_IDS_SQL,
    PUBLIC_PRACTICE_SOURCE_SCOPE_SQL,
} from './practiceQuestionScope';

export type QuizPlayActor = Pick<JWTPayload, 'id' | 'username' | 'role' | 'classId'>;

export type QuizPlayDecision =
    | {
        allowed: true;
        kind: 'public' | 'assigned' | 'staff';
        quizId: string;
        revision: number;
        requiresCode: boolean;
        assignmentId?: string;
    }
    | { allowed: false; code: string };

export interface ResolveQuizPlayAccessInput {
    quizId: string;
    actor: QuizPlayActor | null;
    assignmentId?: string;
    accessCodeVerified?: boolean;
    now: Date;
}

interface QuizAccessRow {
    id: string;
    revision?: number | null;
    show_on_home?: string | number | boolean | null;
    require_code?: string | number | boolean | null;
    time_limit?: number | null;
}

interface AssignmentScopeRow {
    id: string;
    quiz_id: string;
    class_id: string;
    student_id?: string | null;
    deadline?: string | null;
    status?: string | null;
    revoked_at?: string | null;
}

interface CanonicalStudentRow {
    id: string;
    class_id?: string | null;
}

const enabled = (value: unknown): boolean => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    return ['1', 'true', 'yes', 'on', 'enabled'].includes(String(value ?? '').trim().toLowerCase());
};

const quizRevision = (quiz: QuizAccessRow): number => {
    const revision = Number(quiz.revision ?? 1);
    return Number.isSafeInteger(revision) && revision > 0 ? revision : 1;
};

const deny = (code: string): QuizPlayDecision => ({ allowed: false, code });

async function loadQuiz(db: D1Database, quizId: string): Promise<QuizAccessRow | null> {
    return db.prepare(`
        SELECT id, revision, show_on_home, require_code, time_limit
        FROM quizzes WHERE id = ?
    `).bind(quizId).first<QuizAccessRow>();
}

async function loadAssignment(db: D1Database, assignmentId: string): Promise<AssignmentScopeRow | null> {
    return db.prepare(`
        SELECT id, quiz_id, class_id, student_id, deadline, status, revoked_at
        FROM assignments WHERE id = ?
    `).bind(assignmentId).first<AssignmentScopeRow>();
}

async function canonicalStudent(db: D1Database, actor: QuizPlayActor): Promise<CanonicalStudentRow | null> {
    if (actor.id?.trim()) {
        const row = await db.prepare('SELECT id, class_id FROM students WHERE id = ? LIMIT 1')
            .bind(actor.id.trim()).first<CanonicalStudentRow>();
        if (row?.id?.trim()) return row;
    }
    if (!actor.username?.trim()) return null;
    const row = await db.prepare('SELECT id, class_id FROM students WHERE username = ? LIMIT 1')
        .bind(actor.username.trim()).first<CanonicalStudentRow>();
    return row?.id?.trim() ? row : null;
}

async function allowsAssignment(
    db: D1Database,
    quizId: string,
    assignmentId: string,
    actor: QuizPlayActor,
    now: Date,
): Promise<boolean> {
    const assignment = await loadAssignment(db, assignmentId);
    if (!assignment || assignment.quiz_id !== quizId || String(assignment.status).toUpperCase() !== 'OPEN') return false;
    if (assignment.revoked_at) return false;
    if (assignment.deadline) {
        const deadlineMs = Date.parse(assignment.deadline);
        if (!Number.isFinite(deadlineMs) || deadlineMs <= now.getTime()) return false;
    }
    const student = await canonicalStudent(db, actor);
    if (!student?.class_id || student.class_id !== assignment.class_id) return false;
    return !assignment.student_id || assignment.student_id === student.id;
}

export async function resolveQuizPlayAccess(
    db: D1Database,
    input: ResolveQuizPlayAccessInput,
): Promise<QuizPlayDecision> {
    const quiz = await loadQuiz(db, input.quizId);
    if (!quiz) return deny('QUIZ_NOT_FOUND');
    const requiresCode = enabled(quiz.require_code);
    const isPublic = enabled(quiz.show_on_home);
    const revision = quizRevision(quiz);

    if (input.actor && (input.actor.role === 'admin' || input.actor.role === 'teacher')) {
        const allowed = await canAccessQuiz(db, input.actor as JWTPayload, input.quizId);
        return allowed
            ? { allowed: true, kind: 'staff', quizId: input.quizId, revision, requiresCode }
            : deny('QUIZ_SCOPE_DENIED');
    }

    if (!input.actor) {
        if (!isPublic) return deny('QUIZ_SCOPE_DENIED');
        if (requiresCode && !input.accessCodeVerified) return deny('QUIZ_ACCESS_REQUIRED');
        if (!requiresCode || input.accessCodeVerified) {
            return { allowed: true, kind: 'public', quizId: input.quizId, revision, requiresCode };
        }
    }

    if (input.actor?.role === 'student') {
        if (isPublic && !requiresCode && !input.assignmentId) {
            return { allowed: true, kind: 'public', quizId: input.quizId, revision, requiresCode };
        }
        if (input.assignmentId && (!requiresCode || input.accessCodeVerified) && await allowsAssignment(
            db,
            input.quizId,
            input.assignmentId,
            input.actor,
            input.now,
        )) {
            return {
                allowed: true,
                kind: 'assigned',
                quizId: input.quizId,
                revision,
                requiresCode,
                assignmentId: input.assignmentId,
            };
        }
        if (!input.assignmentId && isPublic && requiresCode && input.accessCodeVerified) {
            return { allowed: true, kind: 'public', quizId: input.quizId, revision, requiresCode };
        }
    }

    return deny(input.assignmentId ? 'ASSIGNMENT_SCOPE_DENIED' : 'QUIZ_SCOPE_DENIED');
}

/**
 * A persisted quiz may be used as the learner validation oracle only when it
 * belongs to the same explicitly public pool used by /api/practice.  Keeping
 * this predicate next to the play policy prevents a quiz that is merely shown
 * on the home page from becoming a grading oracle after it is assigned or
 * attached to a protected workflow.
 */
export async function isPublicPracticeQuiz(db: D1Database, quizId: string): Promise<boolean> {
    if (!quizId.trim()) return false;
    const row = await db.prepare(`
        SELECT 1
        ${PUBLIC_PRACTICE_SOURCE_SCOPE_SQL}
          AND public_quiz.id = ?
        LIMIT 1
    `).bind(quizId.trim()).first<{ '1'?: number }>();
    return Boolean(row);
}

export async function isQuizAttachedToProtectedWorkflow(db: D1Database, quizId: string): Promise<boolean> {
    if (!quizId.trim()) return false;
    const row = await db.prepare(`
        SELECT 1
        FROM (${PROTECTED_WORKFLOW_QUIZ_IDS_SQL}) AS protected_workflow
        WHERE protected_workflow.protected_quiz_id = ?
        LIMIT 1
    `).bind(quizId.trim()).first<{ '1'?: number }>();
    return Boolean(row);
}
