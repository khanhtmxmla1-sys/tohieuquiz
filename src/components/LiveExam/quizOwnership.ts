interface CurrentTeacherQuizIdentity {
  username: string | null | undefined;
  teacherName: string | null | undefined;
  isAdmin: boolean;
}

const normalizeOwner = (value: string | null | undefined): string =>
  String(value || '').trim().toLocaleLowerCase('vi');

export function isQuizOwnedByCurrentTeacher(
  createdBy: string | null | undefined,
  identity: CurrentTeacherQuizIdentity,
): boolean {
  if (identity.isAdmin) return true;

  const owner = normalizeOwner(createdBy);
  if (!owner) return false;

  const username = normalizeOwner(identity.username);
  const teacherName = normalizeOwner(identity.teacherName);
  return owner === username || (Boolean(teacherName) && owner === teacherName);
}
