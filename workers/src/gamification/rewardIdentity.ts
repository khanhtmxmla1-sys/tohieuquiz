export interface StudentRewardIdentity {
  studentId: string;
  username: string;
}

export const resolveStudentRewardIdentity = async (
  db: D1Database,
  username: string,
): Promise<StudentRewardIdentity | null> => {
  const row = await db.prepare(`
    SELECT id, username
    FROM students
    WHERE username = ?
    LIMIT 1
  `).bind(username).first<any>();
  if (!row?.id) return null;
  return { studentId: String(row.id), username: String(row.username || username) };
};
