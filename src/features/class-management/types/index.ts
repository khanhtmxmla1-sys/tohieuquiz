/**
 * Feature-specific types for Class Management.
 * Re-exports core classroom types and defines specific view models.
 */

export * from '../../../types/classroom.types';

export interface TeacherRecord {
    username: string;
    full_name: string;
    role: string;
    class: string;
}
