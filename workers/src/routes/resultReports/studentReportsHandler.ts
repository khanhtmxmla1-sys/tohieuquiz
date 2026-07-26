import type {
  StudentResultReportDetail,
  StudentResultReportSummary,
} from '../../../../shared/result-reports.contract';
import { isStudent, verifyJWTMiddleware } from '../../middleware/jwtAuth';
import type { Env } from '../../types';
import {
  getStudentResultReport,
  listStudentResultReports,
  resolveResultReportStudentId,
} from './batchRepository';
import { resultReportError, resultReportSuccess } from './responses';

export interface StudentResultReportDependencies {
  resolveStudentId(id: string | undefined, username: string): Promise<string | null>;
  listStudentReports(studentId: string): Promise<StudentResultReportSummary[]>;
  getStudentReport(studentId: string, phieuId: string): Promise<StudentResultReportDetail | null>;
}

const authorizeStudent = async (
  request: Request,
  env: Env,
  injected?: StudentResultReportDependencies,
) => {
  const authResult = await verifyJWTMiddleware(request, env);
  if (authResult instanceof Response) return authResult;
  if (!isStudent(authResult.user)) {
    return resultReportError('RESULT_REPORT_FORBIDDEN', 'Student access required', 403);
  }
  const deps = injected || {
    resolveStudentId: (id: string | undefined, username: string) => (
      resolveResultReportStudentId(env.DB, id, username)
    ),
    listStudentReports: (studentId: string) => listStudentResultReports(env.DB, studentId),
    getStudentReport: (studentId: string, phieuId: string) => (
      getStudentResultReport(env.DB, studentId, phieuId)
    ),
  };
  const studentId = await deps.resolveStudentId(authResult.user.id, authResult.user.username);
  if (!studentId) {
    return resultReportError('RESULT_REPORT_STUDENT_NOT_FOUND', 'Student account not found', 404);
  }
  return { studentId, deps };
};

export async function handleListMyResultReports(
  request: Request,
  env: Env,
  injected?: StudentResultReportDependencies,
): Promise<Response> {
  const access = await authorizeStudent(request, env, injected);
  if (access instanceof Response) return access;
  return resultReportSuccess(await access.deps.listStudentReports(access.studentId));
}

export async function handleGetMyResultReport(
  request: Request,
  env: Env,
  phieuId: string,
  injected?: StudentResultReportDependencies,
): Promise<Response> {
  const access = await authorizeStudent(request, env, injected);
  if (access instanceof Response) return access;
  const report = await access.deps.getStudentReport(access.studentId, phieuId);
  if (!report) {
    return resultReportError('RESULT_REPORT_NOT_FOUND', 'Result report not found', 404);
  }
  return resultReportSuccess(report);
}
