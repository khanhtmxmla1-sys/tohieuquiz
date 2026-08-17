import type { StudentResult } from '../../../types';
import { areClassNamesEqual } from '../../../utils/classMatching';

interface TeacherClassScopeLike {
  id: string;
  name: string;
}

export const getTeacherDisplayName = (
  teacherName?: string | null,
  username?: string | null,
): string => (teacherName || '').trim() || username || 'Giáo viên';

export const getTeacherInitial = (displayName: string): string => displayName.charAt(0).toUpperCase();

export const getTeacherClassNames = (
  teacherClasses: TeacherClassScopeLike[] = [],
  legacyTeacherClass?: string | null,
): string[] => {
  const canonicalNames = teacherClasses
    .map((classroom) => String(classroom.name || '').trim())
    .filter(Boolean);
  if (canonicalNames.length > 0) return canonicalNames;

  const legacyName = String(legacyTeacherClass || '').trim();
  return legacyName ? [legacyName] : [];
};

export const filterTeacherResults = (
  results: StudentResult[],
  isAdmin: boolean,
  teacherClasses: TeacherClassScopeLike[] = [],
  legacyTeacherClass?: string | null,
): StudentResult[] => {
  if (isAdmin) return results;
  const classNames = getTeacherClassNames(teacherClasses, legacyTeacherClass);
  if (classNames.length === 0) return [];
  return results.filter((result) => classNames.some((className) => areClassNamesEqual(result.studentClass, className)));
};
