import { DAILY_MISSIONS } from './constants';
import type { DailyProgressRow, DashboardMission, MissionId } from './types';

export const getMissionRows = (progress: DailyProgressRow): DashboardMission[] => {
    const accuracy = Math.round(
        (progress.correct_answers / Math.max(progress.questions_answered, 1)) * 100
    );
    return DAILY_MISSIONS.map((mission) => {
        if (mission.id === 'daily_questions') return {
            ...mission,
            progress: progress.questions_answered,
            completed: progress.questions_answered >= mission.target,
            claimed: Number(progress.mission_questions_claimed) === 1,
        };
        if (mission.id === 'daily_accuracy') return {
            ...mission,
            progress: progress.questions_answered >= 10 ? accuracy : 0,
            completed: progress.questions_answered >= 10 && accuracy >= mission.target,
            claimed: Number(progress.mission_accuracy_claimed) === 1,
        };
        const subjectProgress = Number(progress.toan_quizzes_completed)
            + Number(progress.tieng_viet_quizzes_completed);
        return {
            ...mission, progress: subjectProgress,
            completed: subjectProgress >= mission.target,
            claimed: Number(progress.mission_subject_claimed) === 1,
        };
    });
};

export const areAllMissionsClaimed = (missions: DashboardMission[]): boolean =>
    missions.every((mission) => mission.claimed);

export const getMissionClaimColumn = (missionId: MissionId): keyof DailyProgressRow => {
    if (missionId === 'daily_questions') return 'mission_questions_claimed';
    if (missionId === 'daily_accuracy') return 'mission_accuracy_claimed';
    return 'mission_subject_claimed';
};
