import type { StudentResult } from '../../../types';
import { areClassNamesEqual } from '../../../utils/classMatching';

export const getTeacherDisplayName = (
  teacherName?: string | null,
  username?: string | null,
): string => (teacherName || '').trim() || username || 'Giáo viên';

export const getTeacherInitial = (displayName: string): string => displayName.charAt(0).toUpperCase();

export const filterTeacherResults = (
  results: StudentResult[],
  isAdmin: boolean,
  teacherClass?: string | null,
): StudentResult[] => isAdmin || !teacherClass
  ? results
  : results.filter(result => areClassNamesEqual(result.studentClass, teacherClass));
