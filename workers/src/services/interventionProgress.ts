import type { Question } from '../types';
import {
  INTERVENTION_PROGRESS_ACCURACY_DELTA_THRESHOLD,
  INTERVENTION_PROGRESS_MIN_SAMPLE_SIZE,
  type InterventionGroupProgress,
  type InterventionMemberProgress,
  type InterventionProgressStatus,
  type InterventionStudentSignal,
} from '../../../shared/intervention.contract';
import {
  buildWeaknessProfileFromData,
  type ResultRowWithAnswers,
} from './weaknessProfile';

export interface InterventionProgressAssignmentRow {
  id: string;
  intervention_group_id: string;
  student_id: string;
  status: string;
  deadline: string;
  created_at: string;
}

export type InterventionProgressResultRow = ResultRowWithAnswers;

const round = (value: number, digits = 2): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const averageNullable = (values: Array<number | null>): number | null => {
  const finiteValues = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (finiteValues.length === 0) return null;
  return round(finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length, 1);
};

const classifyMemberProgress = (
  assignedCount: number,
  postInterventionSampleSize: number,
  skillAccuracyDelta: number | null,
): InterventionProgressStatus => {
  if (assignedCount === 0) return 'NO_ASSIGNMENT';
  if (
    postInterventionSampleSize < INTERVENTION_PROGRESS_MIN_SAMPLE_SIZE
    || skillAccuracyDelta === null
  ) return 'WAITING_FOR_RESULTS';
  if (skillAccuracyDelta >= INTERVENTION_PROGRESS_ACCURACY_DELTA_THRESHOLD) return 'IMPROVING';
  if (skillAccuracyDelta <= -INTERVENTION_PROGRESS_ACCURACY_DELTA_THRESHOLD) return 'NEEDS_ATTENTION';
  return 'STABLE';
};

export function buildInterventionGroupProgressFromData(input: {
  groupId: string;
  subject: string;
  skillCode: string;
  members: InterventionStudentSignal[];
  assignments: InterventionProgressAssignmentRow[];
  results: InterventionProgressResultRow[];
  questions: Question[];
  evaluatedAt: string;
}): InterventionGroupProgress {
  const memberIds = new Set(input.members.map((member) => member.studentId));
  const assignments = input.assignments.filter((assignment) => (
    assignment.intervention_group_id === input.groupId
    && memberIds.has(String(assignment.student_id || ''))
    && String(assignment.status || 'OPEN').toUpperCase() !== 'REVOKED'
  ));
  const assignmentIds = new Set(assignments.map((assignment) => assignment.id));
  const validResults = input.results.filter((result) => (
    result.assignment_id
    && assignmentIds.has(String(result.assignment_id))
    && memberIds.has(String(result.student_id || ''))
    && result.answers !== '{"status":"STARTED"}'
  ));

  const members = input.members.map((member): InterventionMemberProgress => {
    const memberAssignments = assignments.filter((assignment) => assignment.student_id === member.studentId);
    const memberAssignmentIds = new Set(memberAssignments.map((assignment) => assignment.id));
    const memberResults = validResults
      .filter((result) => (
        result.student_id === member.studentId
        && result.assignment_id
        && memberAssignmentIds.has(String(result.assignment_id))
      ))
      .sort((left, right) => Date.parse(left.submitted_at) - Date.parse(right.submitted_at));
    const completedAssignmentIds = new Set(memberResults.map((result) => String(result.assignment_id)));
    const latestResult = memberResults[memberResults.length - 1] || null;
    const profile = latestResult
      ? buildWeaknessProfileFromData(latestResult, memberResults, input.questions)
      : null;
    const skill = profile?.subjects
      .find((subject) => subject.subject === input.subject)
      ?.skills.find((item) => item.skillCode === input.skillCode);
    const postInterventionSampleSize = Number(skill?.attempted || 0);
    const enoughSkillSamples = postInterventionSampleSize >= INTERVENTION_PROGRESS_MIN_SAMPLE_SIZE;
    const currentSkillAccuracy = enoughSkillSamples ? Number(skill?.accuracy ?? 0) : null;
    const baselineSkillAccuracy = Number(member.skillAccuracy) || 0;
    const skillAccuracyDelta = currentSkillAccuracy === null
      ? null
      : round(currentSkillAccuracy - baselineSkillAccuracy, 1);
    const baselineScore = Number(member.latestAttemptScore) || 0;
    const currentScore = latestResult ? round(Number(latestResult.score) || 0, 1) : null;
    const scoreDelta = currentScore === null ? null : round(currentScore - baselineScore, 1);
    const status = classifyMemberProgress(
      memberAssignments.length,
      postInterventionSampleSize,
      skillAccuracyDelta,
    );

    return {
      studentId: member.studentId,
      baselineSkillAccuracy,
      currentSkillAccuracy,
      skillAccuracyDelta,
      baselineScore,
      currentScore,
      scoreDelta,
      assignedCount: memberAssignments.length,
      completedCount: completedAssignmentIds.size,
      postInterventionSampleSize,
      lastResultAt: latestResult?.submitted_at || null,
      status,
    };
  });

  const assignedCount = members.reduce((sum, member) => sum + member.assignedCount, 0);
  const completedCount = members.reduce((sum, member) => sum + member.completedCount, 0);
  const improvingCount = members.filter((member) => member.status === 'IMPROVING').length;
  const needsAttentionCount = members.filter((member) => member.status === 'NEEDS_ATTENTION').length;
  const waitingCount = members.filter((member) => member.status === 'WAITING_FOR_RESULTS').length;
  let status: InterventionProgressStatus = 'STABLE';
  if (assignedCount === 0) status = 'NO_ASSIGNMENT';
  else if (needsAttentionCount > 0) status = 'NEEDS_ATTENTION';
  else if (waitingCount > 0) status = 'WAITING_FOR_RESULTS';
  else if (improvingCount > 0) status = 'IMPROVING';

  return {
    status,
    assignedCount,
    completedCount,
    completionPercent: assignedCount === 0 ? 0 : Math.round((completedCount / assignedCount) * 100),
    improvingCount,
    needsAttentionCount,
    waitingCount,
    averageSkillAccuracyDelta: averageNullable(members.map((member) => member.skillAccuracyDelta)),
    averageScoreDelta: averageNullable(members.map((member) => member.scoreDelta)),
    evaluatedAt: input.evaluatedAt,
    members,
  };
}
