import { mapAssignment } from '../utils/helpers';

export const getTeacherAssignments = async (
    db: D1Database,
    teacherUsername: string
) => {
    const teacherClasses = await db.prepare(
        'SELECT id FROM classes WHERE teacher_username = ?'
    ).bind(teacherUsername).all();
    const classIds = teacherClasses.results.map((classroom: any) => classroom.id);
    if (classIds.length === 0) return [];

    const placeholders = classIds.map(() => '?').join(',');
    const assignments = await db.prepare(`
        SELECT
            a.*, c.name as class_name, s.full_name as student_name,
            (SELECT COUNT(*) FROM students WHERE class_id = a.class_id) as total_students,
            (
                SELECT COUNT(DISTINCT r.student_name)
                FROM results r
                WHERE r.quiz_id = a.quiz_id
                AND (r.class_name = c.name OR r.class_name = 'Lớp ' || c.name OR REPLACE(r.class_name, 'Lớp ', '') = c.name)
                AND r.answers != '{"status":"STARTED"}'
            ) as submitted_count
        FROM assignments a
        LEFT JOIN classes c ON a.class_id = c.id
        LEFT JOIN students s ON a.student_id = s.id
        WHERE a.class_id IN (${placeholders})
        ORDER BY a.created_at DESC
    `).bind(...classIds).all();
    return assignments.results.map((assignment: any) => ({
        ...mapAssignment(assignment),
        className: assignment.class_name || '',
        studentName: assignment.student_name || '',
        totalStudents: Number(assignment.total_students) || 0,
        submittedCount: Number(assignment.submitted_count) || 0,
    }));
};
