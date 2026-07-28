import type { RouteRegistry } from '../types';

export const actionCenterRoutes: RouteRegistry = {
  get_teacher_action_center: {
    method: 'GET',
    auth: 'session',
    path: () => '/api/teacher/action-center',
  },
};
