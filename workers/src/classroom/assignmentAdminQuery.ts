import { mapAssignment } from '../utils/helpers';

export const getAdminAssignments = async (db: D1Database) => {
    const assignments = await db.prepare(`
        SELECT
            a.*, c.name as class_name, q.title as quiz_title,
            s.full_name as student_name,
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
        LEFT JOIN quizzes q ON a.quiz_id = q.id
        LEFT JOIN students s ON a.student_id = s.id
        ORDER BY a.created_at DESC
    `).all();
    return assignments.results.map((assignment: any) => ({
        ...mapAssignment(assignment),
        className: assignment.class_name || '',
        quizTitle: assignment.quiz_title || 'Bài tập',
        studentName: assignment.student_name || '',
        totalStudents: Number(assignment.total_students) || 0,
        submittedCount: Number(assignment.submitted_count) || 0,
    }));
};
