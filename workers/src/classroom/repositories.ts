export const getStudentById = (
    db: D1Database,
    studentId: string
): Promise<any | null> => db.prepare(
    'SELECT id, username, full_name, class_id FROM students WHERE id = ?'
).bind(studentId).first<any>();

export const getClassroomById = (
    db: D1Database,
    classId: string
): Promise<any | null> => db.prepare(
    'SELECT id, name, teacher_username, created_at, archived_at FROM classes WHERE id = ?'
).bind(classId).first<any>();

export const getAssignmentOwner = (
    db: D1Database,
    assignmentId: string
): Promise<any | null> => db.prepare(
    'SELECT id, class_id FROM assignments WHERE id = ?'
).bind(assignmentId).first<any>();
