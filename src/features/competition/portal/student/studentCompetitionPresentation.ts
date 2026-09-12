import type { CompetitionEntryPreflightReason } from '../../../../../shared/competition-portal.contract';

const competitionPreflightReasonMessages: Record<CompetitionEntryPreflightReason, string> = {
  NOT_IN_AUDIENCE: 'Em không thuộc danh sách tham gia cuộc thi.',
  ROUND_CAMPAIGN_MISMATCH: 'Vòng thi không thuộc cuộc thi này.',
  ROUND_NOT_OPEN: 'Vòng thi hiện chưa mở.',
  PREREQUISITE_NOT_MET: 'Em chưa hoàn thành điều kiện của vòng trước.',
  ELIGIBILITY_BLOCKED: 'Em chưa đủ điều kiện tham gia vòng thi.',
  ATTEMPT_LIMIT_REACHED: 'Đã hết số lượt thi cho phép.',
  QUIZ_MAPPING_UNAVAILABLE: 'Chưa có đề thi phù hợp với lớp của em.',
  SCHOOL_EXAM_NOT_QUALIFIED: 'Em chưa đủ điều kiện tham gia thi cấp trường.',
  SCHOOL_EXAM_EVENT_NOT_READY: 'Kỳ thi cấp trường chưa sẵn sàng. Em hãy thử lại sau.',
  SCHOOL_EXAM_MEMBER_NOT_READY: 'Thông tin dự thi cấp trường của em chưa sẵn sàng.',
  SCHOOL_EXAM_ROOM_NOT_READY: 'Phòng thi cấp trường chưa sẵn sàng.',
  SCHOOL_EXAM_WINDOW_NOT_OPEN: 'Chưa đến giờ vào thi cấp trường. Em hãy xem lại lịch thi.',
  SCHOOL_EXAM_WINDOW_CLOSED: 'Đã hết thời gian vào thi cấp trường.',
  SCHOOL_EXAM_CAPACITY_NOT_CERTIFIED: 'Hệ thống thi cấp trường đang được kiểm tra để bảo đảm ổn định.',
  SCHOOL_EXAM_SESSION_NOT_PROVISIONED: 'Phiên thi cấp trường chưa được mở. Em hãy thử lại sau.',
  SCHOOL_EXAM_PARTICIPANT_SCOPE_MISMATCH: 'Thông tin thí sinh chưa khớp với phòng thi cấp trường.',
  SCHOOL_EXAM_ACCESS_CODE_INVALID: 'Mã phòng thi cấp trường không hợp lệ. Em hãy thử lại hoặc báo giáo viên.',
  SCHOOL_EXAM_CANDIDATE_CODE_INVALID: 'Mã thí sinh thi cấp trường không hợp lệ. Em hãy báo giáo viên để được hỗ trợ.',
};

const GENERIC_PREFLIGHT_MESSAGE = 'Không thể tham gia thi cấp trường lúc này. Em hãy thử lại sau.';

const competitionPreflightReasons = new Set<CompetitionEntryPreflightReason>(
  Object.keys(competitionPreflightReasonMessages) as CompetitionEntryPreflightReason[],
);

export const getCompetitionPreflightReasonMessage = (
  reason: CompetitionEntryPreflightReason,
): string => competitionPreflightReasonMessages[reason] ?? GENERIC_PREFLIGHT_MESSAGE;

export const getCompetitionPreflightErrorMessage = (cause: unknown): string => {
  const rawMessage = cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : '';
  if (competitionPreflightReasons.has(rawMessage as CompetitionEntryPreflightReason)) {
    return getCompetitionPreflightReasonMessage(rawMessage as CompetitionEntryPreflightReason);
  }
  return GENERIC_PREFLIGHT_MESSAGE;
};
