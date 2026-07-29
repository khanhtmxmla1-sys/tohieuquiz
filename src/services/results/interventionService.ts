import type {
  AddInterventionNoteRequest,
  CreateInterventionAssignmentsRequest,
  CreateInterventionAssignmentsResponse,
  CreateInterventionGroupRequest,
  InterventionDashboard,
  InterventionGroup,
  InterventionPrivateNote,
} from '../../../shared/intervention.contract';
import { callApi } from '../apiAdapter';

interface ApiResponse<T> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
}

const unwrap = <T>(response: ApiResponse<T>, fallback: string): T => {
  if (response.status === 'success' && response.data) return response.data;
  throw new Error(response.message || fallback);
};

export const getInterventionDashboard = async (filters: {
  className?: string;
  quizId?: string;
} = {}): Promise<InterventionDashboard> => {
  const response = await callApi<ApiResponse<InterventionDashboard>>(
    'get_result_interventions',
    filters,
  );
  return unwrap(response, 'Không thể tải trung tâm hỗ trợ học tập.');
};

export const createInterventionGroup = async (
  request: CreateInterventionGroupRequest,
): Promise<InterventionGroup> => {
  const response = await callApi<ApiResponse<InterventionGroup>>(
    'create_intervention_group',
    request,
  );
  return unwrap(response, 'Không thể tạo nhóm hỗ trợ.');
};

export const addInterventionNote = async (
  groupId: string,
  request: AddInterventionNoteRequest,
): Promise<InterventionPrivateNote> => {
  const response = await callApi<ApiResponse<InterventionPrivateNote>>(
    'add_intervention_note',
    { groupId, ...request },
  );
  return unwrap(response, 'Không thể lưu ghi chú riêng.');
};

export const createInterventionAssignments = async (
  groupId: string,
  request: CreateInterventionAssignmentsRequest,
): Promise<CreateInterventionAssignmentsResponse> => {
  const response = await callApi<ApiResponse<CreateInterventionAssignmentsResponse>>(
    'create_intervention_assignments',
    { groupId, ...request },
  );
  return unwrap(response, 'Không thể giao bài luyện tập cho nhóm.');
};
