import { getSystemWeekKey, getSystemWeekUtcRange } from '../utils/systemTime';
import type { Question } from '../types';
import {
  INTERVENTION_DECLINING_SCORE_DELTA_THRESHOLD,
  INTERVENTION_MIN_CONFIDENCE,
  INTERVENTION_MIN_SAMPLE_SIZE,
  INTERVENTION_PERSISTENT_ACCURACY_THRESHOLD,
  INTERVENTION_PERSISTENT_ATTEMPT_THRESHOLD,
  buildInterventionSuggestionKey,
  isInterventionSignalEligible,
  type InterventionDataReadiness,
  type InterventionQuizRecommendation,
  type InterventionStudentSignal,
  type InterventionSuggestion,
  type InterventionTrendPoint,
} from '../../../shared/intervention.contract';
import {
  resolveExplicitSkillMetadata,
  resolveSkillMetadataFromTags,
} from '../../../src/shared/skillTaxonomy';
import {
  buildWeaknessProfileFromData,
  parseStoredAnswers,
  type ResultRowWithAnswers,
} from './weaknessProfile';

export interface InterventionStudentRow {
  id: string;
  full_name: string;
  class_id: string;
  class_name: string;
}

export interface InterventionResultRow extends ResultRowWithAnswers {
  student_id?: string | null;
}

export interface RecommendationQuestionRow {
  quiz_id: string;
  title: string;
  subject?: string | null;
  skill_code?: string | null;
  subskill_code?: string | null;
  tags?: string | null;
}

export interface BuildSuggestionInput {
  students: InterventionStudentRow[];
  results: InterventionResultRow[];
  questions: Question[];
  recommendationRows: RecommendationQuestionRow[];
  now?: Date;
}

const round = (value: number, digits = 2): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const INTERVENTION_SKILL_LABEL_OVERRIDES: Record<string, string> = {
  phan_so: 'Phân số',
};
const getInterventionSkillLabel = (skillCode: string, fallback: string): string => (
  INTERVENTION_SKILL_LABEL_OVERRIDES[skillCode] || fallback
);

export const createEmptyInterventionReadiness = (): InterventionDataReadiness => ({
  studentsInScope: 0,
  resultsInWindow: 0,
  quizzesInScope: 0,
  questionsInScope: 0,
  questionsWithSkillMetadata: 0,
  skillMetadataCoveragePercent: 0,
  studentSkillSignals: 0,
  eligibleSignals: 0,
  excludedSignals: {
    stable: 0,
    insufficientSamples: 0,
    lowConfidence: 0,
    missingMetadata: 0,
  },
});

const resolveReadinessSkillMetadata = (
  source: Record<string, unknown> | null | undefined,
  origin: 'explicit_db' | 'explicit_question',
) => {
  if (!source) return null;
  return resolveExplicitSkillMetadata({
    subject: String(source.subject || '') || undefined,
    skillCode: String(source.skillCode || source.skill_code || '') || undefined,
    subskillCode: String(source.subskillCode || source.subskill_code || '') || undefined,
  }, origin) || resolveSkillMetadataFromTags(source.tags as string | string[] | undefined);
};

export const buildInterventionReadinessFromData = (
  students: InterventionStudentRow[],
  results: InterventionResultRow[],
  questions: Question[],
): InterventionDataReadiness => {
  const readiness = createEmptyInterventionReadiness();
  readiness.studentsInScope = students.length;
  readiness.resultsInWindow = results.length;
  readiness.quizzesInScope = new Set(results.map((result) => String(result.quiz_id || '')).filter(Boolean)).size;
  readiness.questionsInScope = questions.length;

  const questionsById = new Map(questions.map((question) => [String(question.id), question]));
  const questionIdsWithMetadata = new Set<string>();
  for (const question of questions) {
    if (resolveReadinessSkillMetadata(question as unknown as Record<string, unknown>, 'explicit_db')) {
      questionIdsWithMetadata.add(String(question.id));
    }
  }
  for (const result of results) {
    const answers = parseStoredAnswers(result.answers);
    for (const [questionId, answerData] of Object.entries(answers)) {
      if (questionId.startsWith('_') || !questionsById.has(questionId)) continue;
      const snapshot = answerData && typeof answerData === 'object'
        ? (answerData as { questionSnapshot?: Record<string, unknown> }).questionSnapshot
        : undefined;
      if (resolveReadinessSkillMetadata(snapshot, 'explicit_question')) {
        questionIdsWithMetadata.add(questionId);
      }
    }
  }
  readiness.questionsWithSkillMetadata = questionIdsWithMetadata.size;
  readiness.skillMetadataCoveragePercent = readiness.questionsInScope === 0
    ? 0
    : Math.round((readiness.questionsWithSkillMetadata / readiness.questionsInScope) * 100);
  // missingMetadata is question-level because no skill code exists to form a student-skill signal.
  readiness.excludedSignals.missingMetadata = Math.max(
    0,
    readiness.questionsInScope - readiness.questionsWithSkillMetadata,
  );

  const studentsById = new Map(students.map((student) => [student.id, student]));
  const resultsByStudentId = new Map<string, InterventionResultRow[]>();
  for (const result of results) {
    const student = resolveStudentForResult(result, studentsById);
    if (!student) continue;
    const studentResults = resultsByStudentId.get(student.id) || [];
    studentResults.push(result);
    resultsByStudentId.set(student.id, studentResults);
  }

  for (const student of students) {
    const studentResults = (resultsByStudentId.get(student.id) || [])
      .sort((left, right) => Date.parse(left.submitted_at) - Date.parse(right.submitted_at));
    if (studentResults.length === 0) continue;
    const profile = buildWeaknessProfileFromData(
      studentResults[studentResults.length - 1],
      studentResults,
      questions,
    );
    const coverageFactor = Math.max(0, Math.min(1, profile.coveragePercent / 100));
    for (const subjectGroup of profile.subjects) {
      for (const skill of subjectGroup.skills) {
        readiness.studentSkillSignals += 1;
        if (skill.status === 'stable') {
          readiness.excludedSignals.stable += 1;
          continue;
        }
        const confidence = round(coverageFactor * (skill.attempted / (skill.attempted + 2)), 2);
        if (skill.attempted < INTERVENTION_MIN_SAMPLE_SIZE) {
          readiness.excludedSignals.insufficientSamples += 1;
          continue;
        }
        if (confidence < INTERVENTION_MIN_CONFIDENCE) {
          readiness.excludedSignals.lowConfidence += 1;
          continue;
        }
        readiness.eligibleSignals += 1;
      }
    }
  }

  return readiness;
};

const buildFourWeekTrend = (
  results: InterventionResultRow[],
  now: Date,
): InterventionTrendPoint[] => [3, 2, 1, 0].map((weeksAgo) => {
  const targetInstant = new Date(now.getTime() - weeksAgo * 7 * 86_400_000);
  const range = getSystemWeekUtcRange(getSystemWeekKey(targetInstant));
  const startMs = Date.parse(range.startIso);
  const endMs = Date.parse(range.endIsoExclusive);
  const scores = results
    .filter((result) => {
      const submittedAt = Date.parse(String(result.submitted_at || ''));
      return Number.isFinite(submittedAt)
        && submittedAt >= startMs
        && submittedAt < endMs;
    })
    .map((result) => Number(result.score))
    .filter(Number.isFinite);
  return {
    weekStart: range.startDateKey,
    averageScore: scores.length
      ? round(scores.reduce((sum, score) => sum + score, 0) / scores.length, 1)
      : null,
    attemptCount: scores.length,
  };
});

const resolveStudentForResult = (
  result: InterventionResultRow,
  studentsById: Map<string, InterventionStudentRow>,
): InterventionStudentRow | null => {
  if (!result.student_id || !result.class_id) return null;
  const direct = studentsById.get(String(result.student_id));
  return direct && String(direct.class_id) === String(result.class_id) ? direct : null;
};

const buildRecommendations = (
  rows: RecommendationQuestionRow[],
  subject: string,
  skillCode: string,
): InterventionQuizRecommendation[] => {
  const grouped = new Map<string, {
    quizId: string;
    title: string;
    questionCount: number;
    matchedQuestionCount: number;
  }>();

  for (const row of rows) {
    const bucket = grouped.get(row.quiz_id) || {
      quizId: row.quiz_id,
      title: row.title,
      questionCount: 0,
      matchedQuestionCount: 0,
    };
    bucket.questionCount += 1;
    const metadata = resolveExplicitSkillMetadata({
      subject: row.subject || undefined,
      skillCode: row.skill_code || undefined,
      subskillCode: row.subskill_code || undefined,
    }, 'explicit_db') || resolveSkillMetadataFromTags(row.tags || undefined);
    if (metadata?.subject === subject && metadata.skillCode === skillCode) {
      bucket.matchedQuestionCount += 1;
    }
    grouped.set(row.quiz_id, bucket);
  }

  return Array.from(grouped.values())
    .filter((quiz) => quiz.matchedQuestionCount > 0)
    .map((quiz) => ({
      ...quiz,
      confidence: round(quiz.matchedQuestionCount / Math.max(1, quiz.questionCount), 2),
    }))
    .sort((left, right) => {
      if (left.confidence !== right.confidence) return right.confidence - left.confidence;
      if (left.matchedQuestionCount !== right.matchedQuestionCount) {
        return right.matchedQuestionCount - left.matchedQuestionCount;
      }
      return left.title.localeCompare(right.title);
    })
    .slice(0, 3);
};

const buildSuggestionEvidence = (
  students: InterventionStudentSignal[],
): InterventionSuggestion['evidence'] => {
  const count = Math.max(1, students.length);
  const averageSkillAccuracy = round(
    students.reduce((sum, student) => sum + student.skillAccuracy, 0) / count,
    1,
  );
  const minimumSkillAccuracy = students.length > 0
    ? round(Math.min(...students.map((student) => student.skillAccuracy)), 1)
    : 0;
  const recentAttemptCount = students.reduce((sum, student) => sum + student.skillSampleSize, 0);
  const averageScoreDelta = round(
    students.reduce((sum, student) => sum + student.scoreDelta, 0) / count,
    1,
  );
  const improvingStudentCount = students.filter((student) => student.scoreDelta > 0).length;
  const decliningStudentCount = students.filter((student) => student.scoreDelta < 0).length;
  const unchangedStudentCount = Math.max(
    0,
    students.length - improvingStudentCount - decliningStudentCount,
  );

  let reason: InterventionSuggestion['evidence']['reason'] = 'LOW_ACCURACY';
  if (averageScoreDelta <= INTERVENTION_DECLINING_SCORE_DELTA_THRESHOLD) {
    reason = 'DECLINING_TREND';
  } else if (
    recentAttemptCount >= INTERVENTION_PERSISTENT_ATTEMPT_THRESHOLD
    && averageSkillAccuracy <= INTERVENTION_PERSISTENT_ACCURACY_THRESHOLD
  ) {
    reason = 'PERSISTENT_WEAKNESS';
  }

  return {
    reason,
    averageSkillAccuracy,
    minimumSkillAccuracy,
    recentAttemptCount,
    improvingStudentCount,
    unchangedStudentCount,
    decliningStudentCount,
  };
};

export function buildInterventionSuggestionsFromData(
  input: BuildSuggestionInput,
): InterventionSuggestion[] {
  const now = input.now || new Date();
  const studentsById = new Map(input.students.map((student) => [student.id, student]));
  const resultsByStudentId = new Map<string, InterventionResultRow[]>();

  for (const result of input.results) {
    const student = resolveStudentForResult(result, studentsById);
    if (!student) continue;
    const studentResults = resultsByStudentId.get(student.id) || [];
    studentResults.push(result);
    resultsByStudentId.set(student.id, studentResults);
  }

  const buckets = new Map<string, {
    key: string;
    classId: string;
    className: string;
    subject: string;
    subjectLabel: string;
    skillCode: string;
    skillLabel: string;
    sampleSize: number;
    weightedConfidence: number;
    students: InterventionStudentSignal[];
  }>();

  for (const student of input.students) {
    const studentResults = (resultsByStudentId.get(student.id) || [])
      .sort((left, right) => Date.parse(left.submitted_at) - Date.parse(right.submitted_at));
    if (studentResults.length === 0) continue;
    const latestResult = studentResults[studentResults.length - 1];
    const profile = buildWeaknessProfileFromData(latestResult, studentResults, input.questions);
    const firstScore = Number(studentResults[0].score) || 0;
    const latestScore = Number(latestResult.score) || 0;

    for (const subjectGroup of profile.subjects) {
      for (const skill of subjectGroup.skills) {
        if (skill.status === 'stable') continue;
        const coverageFactor = Math.max(0, Math.min(1, profile.coveragePercent / 100));
        const confidence = round(coverageFactor * (skill.attempted / (skill.attempted + 2)), 2);
        if (!isInterventionSignalEligible(skill.attempted, confidence)) continue;

        const key = buildInterventionSuggestionKey(student.class_id, skill.subject, skill.skillCode);
        const signal: InterventionStudentSignal = {
          studentId: student.id,
          studentName: student.full_name,
          classId: student.class_id,
          className: student.class_name,
          latestResultId: String(latestResult.id),
          latestSubmittedAt: latestResult.submitted_at,
          firstAttemptScore: round(firstScore, 1),
          latestAttemptScore: round(latestScore, 1),
          scoreDelta: round(latestScore - firstScore, 1),
          attemptCount: studentResults.length,
          skillAccuracy: skill.accuracy,
          skillSampleSize: skill.attempted,
          confidence,
          fourWeekTrend: buildFourWeekTrend(studentResults, now),
        };
        const bucket = buckets.get(key) || {
          key,
          classId: student.class_id,
          className: student.class_name,
          subject: skill.subject,
          subjectLabel: skill.subjectLabel,
          skillCode: skill.skillCode,
          skillLabel: getInterventionSkillLabel(skill.skillCode, skill.skillLabel),
          sampleSize: 0,
          weightedConfidence: 0,
          students: [],
        };
        bucket.sampleSize += skill.attempted;
        bucket.weightedConfidence += confidence * skill.attempted;
        bucket.students.push(signal);
        buckets.set(key, bucket);
      }
    }
  }

  return Array.from(buckets.values())
    .map((bucket): InterventionSuggestion => {
      const confidence = round(
        bucket.weightedConfidence / Math.max(1, bucket.sampleSize),
        2,
      );
      const average = (selector: (student: InterventionStudentSignal) => number) => round(
        bucket.students.reduce((sum, student) => sum + selector(student), 0)
          / Math.max(1, bucket.students.length),
        1,
      );
      return {
        key: bucket.key,
        title: `Cần hỗ trợ ở ${bucket.skillLabel}`,
        classId: bucket.classId,
        className: bucket.className,
        subject: bucket.subject,
        subjectLabel: bucket.subjectLabel,
        skillCode: bucket.skillCode,
        skillLabel: bucket.skillLabel,
        sampleSize: bucket.sampleSize,
        confidence,
        studentCount: bucket.students.length,
        averageFirstScore: average((student) => student.firstAttemptScore),
        averageLatestScore: average((student) => student.latestAttemptScore),
        averageScoreDelta: average((student) => student.scoreDelta),
        evidence: buildSuggestionEvidence(bucket.students),
        students: bucket.students.sort((left, right) => {
          if (left.skillAccuracy !== right.skillAccuracy) return left.skillAccuracy - right.skillAccuracy;
          return left.studentName.localeCompare(right.studentName);
        }),
        recommendedQuizzes: buildRecommendations(
          input.recommendationRows,
          bucket.subject,
          bucket.skillCode,
        ),
      };
    })
    .filter((suggestion) => isInterventionSignalEligible(
      suggestion.sampleSize,
      suggestion.confidence,
    ))
    .sort((left, right) => {
      if (left.studentCount !== right.studentCount) return right.studentCount - left.studentCount;
      if (left.confidence !== right.confidence) return right.confidence - left.confidence;
      return left.title.localeCompare(right.title);
    })
    .slice(0, 12);
}
