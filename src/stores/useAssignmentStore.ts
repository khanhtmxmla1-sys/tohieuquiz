import { create } from 'zustand';
import type { Assignment, CreateAssignmentPayload } from '../types/classroom.types';
import * as classroomService from '../services/classroomService';

interface AssignmentStore {
    assignments: Assignment[];
    isLoading: boolean;
    error: string | null;

    fetchAssignments: (classId: string) => Promise<void>;
    fetchTeacherAssignments: (teacherUsername: string) => Promise<void>;
    fetchAllAssignments: () => Promise<void>;
    fetchStudentAssignments: (studentId: string) => Promise<void>;
    addAssignment: (payload: CreateAssignmentPayload) => Promise<Assignment | null>;
    removeAssignment: (assignmentId: string) => Promise<boolean>;
    updateAssignmentDeadline: (assignmentId: string, newDeadline: string) => Promise<boolean>;
    updateAssignmentStatus: (assignmentId: string, newStatus: 'OPEN' | 'CLOSED') => Promise<boolean>;
    startAssignmentAttempt: (assignmentId: string, studentId: string) => Promise<boolean>;
    resetAssignments: () => void;
    clearError: () => void;
}

export const useAssignmentStore = create<AssignmentStore>((set) => ({
    assignments: [],
    isLoading: false,
    error: null,

    fetchAssignments: async (classId) => {
        set({ isLoading: true, error: null });
        try {
            const assignments = await classroomService.getAssignments(classId);
            set({ assignments, isLoading: false });
        } catch {
            set({ error: 'Khong the tai danh sach bai tap.', isLoading: false });
        }
    },

    fetchTeacherAssignments: async (teacherUsername) => {
        set({ isLoading: true, error: null });
        try {
            const assignments = await classroomService.getTeacherAssignments(teacherUsername);
            set({ assignments, isLoading: false });
        } catch {
            set({ error: 'Khong the tai danh sach bai giao.', isLoading: false });
        }
    },

    fetchAllAssignments: async () => {
        set({ isLoading: true, error: null });
        try {
            const assignments = await classroomService.getAllAssignments();
            set({ assignments, isLoading: false });
        } catch {
            set({ error: 'Khong the tai toan bo danh sach bai giao.', isLoading: false });
        }
    },

    fetchStudentAssignments: async (studentId) => {
        set({ isLoading: true, error: null });
        try {
            const assignments = await classroomService.getStudentAssignments(studentId);
            set({ assignments, isLoading: false });
        } catch {
            set({ error: 'Khong the tai bai tap.', isLoading: false });
        }
    },

    addAssignment: async (payload) => {
        set({ isLoading: true, error: null });
        try {
            const assignment = await classroomService.createAssignment(payload);
            if (assignment) {
                set((state) => ({ assignments: [...state.assignments, assignment], isLoading: false }));
                return assignment;
            }
            set({ error: 'Khong the giao bai.', isLoading: false });
            return null;
        } catch {
            set({ error: 'Loi khi giao bai.', isLoading: false });
            return null;
        }
    },

    removeAssignment: async (assignmentId) => {
        set({ isLoading: true, error: null });
        try {
            const ok = await classroomService.deleteAssignment(assignmentId);
            if (ok) {
                set((state) => ({
                    assignments: state.assignments.filter((item) => item.id !== assignmentId),
                    isLoading: false,
                }));
            } else {
                set({ isLoading: false });
            }
            return ok;
        } catch {
            set({ error: 'Loi khi xoa bai tap.', isLoading: false });
            return false;
        }
    },

    updateAssignmentDeadline: async (assignmentId, newDeadline) => {
        set({ isLoading: true, error: null });
        try {
            const ok = await classroomService.updateAssignmentDeadline(assignmentId, newDeadline);
            if (ok) {
                const newStatus = new Date(newDeadline) > new Date() ? 'OPEN' : 'CLOSED';
                set((state) => ({
                    assignments: state.assignments.map((assignment) =>
                        assignment.id === assignmentId
                            ? { ...assignment, deadline: newDeadline, status: newStatus }
                            : assignment
                    ),
                    isLoading: false,
                }));
            } else {
                set({ error: 'Khong the cap nhat han nop.', isLoading: false });
            }
            return ok;
        } catch {
            set({ error: 'Loi khi cap nhat han nop.', isLoading: false });
            return false;
        }
    },

    updateAssignmentStatus: async (assignmentId, newStatus) => {
        set({ isLoading: true, error: null });
        try {
            const ok = await classroomService.updateAssignmentStatus(assignmentId, newStatus);
            if (ok) {
                set((state) => ({
                    assignments: state.assignments.map((assignment) =>
                        assignment.id === assignmentId ? { ...assignment, status: newStatus } : assignment
                    ),
                    isLoading: false,
                }));
            } else {
                set({ error: 'Khong the cap nhat trang thai.', isLoading: false });
            }
            return ok;
        } catch {
            set({ error: 'Loi khi cap nhat trang thai.', isLoading: false });
            return false;
        }
    },

    startAssignmentAttempt: async (assignmentId, studentId) => {
        try {
            await classroomService.startAssignmentAttempt(assignmentId, studentId);
            return true;
        } catch (err) {
            console.error('Failed to start assignment attempt', err);
            return false;
        }
    },

    resetAssignments: () => set({ assignments: [], isLoading: false, error: null }),

    clearError: () => set({ error: null }),
}));
