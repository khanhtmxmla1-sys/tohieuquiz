import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StudentResult } from '../src/types';

const mocks = vi.hoisted(() => ({
    saveAs: vi.fn(),
}));

vi.mock('file-saver', () => ({
    saveAs: mocks.saveAs,
}));

import {
    buildLatestResultsSheetData,
    exportLatestResultsXlsx,
    selectLatestResults,
} from '../src/components/TeacherDashboard/results-tab/resultsExport';

const makeResult = (overrides: Partial<StudentResult> & Pick<StudentResult, 'id'>): StudentResult => ({
    id: overrides.id,
    quizId: overrides.quizId ?? 'quiz-1',
    studentId: overrides.studentId,
    classId: overrides.classId,
    studentName: overrides.studentName ?? 'Nguyễn Văn An',
    studentClass: overrides.studentClass ?? '3A',
    score: overrides.score ?? 8,
    correctCount: overrides.correctCount ?? 8,
    totalQuestions: overrides.totalQuestions ?? 10,
    timeTaken: overrides.timeTaken ?? 12,
    submittedAt: overrides.submittedAt ?? '2026-09-12T08:00:00.000Z',
    answers: overrides.answers ?? {},
    quizTitle: overrides.quizTitle,
});

const valueOf = (cell: unknown) => (
    cell && typeof cell === 'object' && 'value' in cell
        ? (cell as { value?: unknown }).value
        : cell
);

describe('results export', () => {
    beforeEach(() => {
        mocks.saveAs.mockReset();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('selects one newest attempt per quiz and student identity', () => {
        const selected = selectLatestResults([
            makeResult({
                id: 'canonical-old',
                studentId: 'student-1',
                studentName: 'Tên cũ',
                submittedAt: '2026-09-12T08:00:00.000Z',
                score: 6,
            }),
            makeResult({
                id: 'canonical-new',
                studentId: 'student-1',
                studentName: 'Tên mới',
                submittedAt: '2026-09-12T09:00:00.000Z',
                score: 9,
            }),
            makeResult({
                id: 'canonical-tie-1',
                studentId: 'student-1',
                submittedAt: '2026-09-12T10:00:00.000Z',
                score: 7,
            }),
            makeResult({
                id: 'canonical-tie-2',
                studentId: 'student-1',
                submittedAt: '2026-09-12T10:00:00.000Z',
                score: 8,
            }),
            makeResult({
                id: 'same-student-other-quiz',
                studentId: 'student-1',
                quizId: 'quiz-2',
                submittedAt: '2026-09-12T07:00:00.000Z',
            }),
            makeResult({
                id: 'legacy-old',
                studentId: undefined,
                classId: 'class-3a',
                studentName: ' Nguyễn Văn An ',
                submittedAt: '2026-09-12T08:00:00.000Z',
                score: 5,
            }),
            makeResult({
                id: 'legacy-new',
                studentId: undefined,
                classId: 'class-3a',
                studentName: 'NGUYEN   VAN AN',
                submittedAt: '2026-09-12T09:00:00.000Z',
                score: 8,
            }),
        ]);

        expect(selected.map((result) => result.id)).toEqual([
            'canonical-tie-2',
            'same-student-other-quiz',
            'legacy-new',
        ]);
        expect(selected.find((result) => result.id === 'canonical-tie-2')?.score).toBe(8);
    });

    it('uses numeric descending order for integer result ids at a timestamp tie', () => {
        const selected = selectLatestResults([
            makeResult({
                id: '9',
                studentId: 'student-1',
                submittedAt: '2026-09-12T10:00:00.000Z',
                score: 7,
            }),
            makeResult({
                id: '10',
                studentId: 'student-1',
                submittedAt: '2026-09-12T10:00:00.000Z',
                score: 8,
            }),
        ]);

        expect(selected.map((result) => result.id)).toEqual(['10']);
    });

    it('uses the displayed studentClass before classId for legacy identity', () => {
        const selected = selectLatestResults([
            makeResult({
                id: 'legacy-mixed-old',
                classId: 'old-class-id',
                studentClass: '3A',
                studentName: 'Nguyễn Văn An',
                submittedAt: '2026-09-12T08:00:00.000Z',
                score: 5,
            }),
            makeResult({
                id: 'legacy-mixed-new',
                classId: undefined,
                studentClass: ' 3a ',
                studentName: 'NGUYEN VAN AN',
                submittedAt: '2026-09-12T09:00:00.000Z',
                score: 8,
            }),
        ]);

        expect(selected.map((result) => result.id)).toEqual(['legacy-mixed-new']);
    });

    it('keeps ambiguous displayed-class aliases separate from each canonical class', () => {
        const selected = selectLatestResults([
            makeResult({
                id: 'class-a-result',
                classId: 'class-a',
                studentClass: '3A',
                studentName: 'Nguyễn Văn An',
                submittedAt: '2026-09-12T08:00:00.000Z',
            }),
            makeResult({
                id: 'class-b-result',
                classId: 'class-b',
                studentClass: '3A',
                studentName: 'NGUYEN VAN AN',
                submittedAt: '2026-09-12T08:30:00.000Z',
            }),
            makeResult({
                id: 'ambiguous-legacy-result',
                classId: undefined,
                studentClass: '3a',
                studentName: ' Nguyễn Văn An ',
                submittedAt: '2026-09-12T09:00:00.000Z',
            }),
        ]);

        expect(selected.map((result) => result.id)).toEqual([
            'class-a-result',
            'class-b-result',
            'ambiguous-legacy-result',
        ]);
    });

    it('keeps malformed rows with no usable student identity separate by result id', () => {
        const selected = selectLatestResults([
            makeResult({
                id: 'malformed-one',
                studentId: ' ',
                classId: ' ',
                studentClass: ' ',
                studentName: ' ',
                submittedAt: '2026-09-12T08:00:00.000Z',
            }),
            makeResult({
                id: 'malformed-two',
                studentId: '',
                classId: undefined,
                studentClass: '',
                studentName: '',
                submittedAt: '2026-09-12T09:00:00.000Z',
            }),
        ]);

        expect(selected.map((result) => result.id)).toEqual(['malformed-one', 'malformed-two']);
    });

    it('keeps malformed rows with blank ids separate by their stable input positions', () => {
        const selected = selectLatestResults([
            makeResult({
                id: '',
                studentId: ' ',
                classId: ' ',
                studentClass: ' ',
                studentName: ' ',
                submittedAt: '2026-09-12T08:00:00.000Z',
            }),
            makeResult({
                id: '',
                studentId: '',
                classId: undefined,
                studentClass: '',
                studentName: '',
                submittedAt: '2026-09-12T09:00:00.000Z',
            }),
        ]);

        expect(selected).toHaveLength(2);
    });

    it('builds the five-column latest-score sheet with minute durations and no formulas', () => {
        const data = buildLatestResultsSheetData([
            makeResult({
                id: 'result-new',
                studentId: 'student-1',
                studentName: 'Nguyễn Văn An',
                quizTitle: 'Bài kiểm tra phân số',
                score: 9.5,
                timeTaken: 12,
                submittedAt: '2026-09-12T09:00:00.000Z',
            }),
            makeResult({
                id: 'result-fallback-title',
                studentId: 'student-2',
                quizId: 'quiz-without-title',
                quizTitle: '   ',
                studentName: 'Trần Thị Bình',
                score: 7,
                timeTaken: 4.5,
            }),
        ]);

        expect(data.map((row) => row.map(valueOf))).toEqual([
            ['STT', 'Họ và tên', 'Bài kiểm tra', 'Điểm', 'Thời gian làm'],
            [1, 'Nguyễn Văn An', 'Bài kiểm tra phân số', 9.5, '12 phút'],
            [2, 'Trần Thị Bình', 'quiz-without-title', 7, '4.5 phút'],
        ]);
        expect(data[0]).toEqual([
            { value: 'STT', fontWeight: 'bold' },
            { value: 'Họ và tên', fontWeight: 'bold' },
            { value: 'Bài kiểm tra', fontWeight: 'bold' },
            { value: 'Điểm', fontWeight: 'bold' },
            { value: 'Thời gian làm', fontWeight: 'bold' },
        ]);
        expect(data.flat().some((cell) => (
            cell && typeof cell === 'object' && 'type' in cell && (cell as { type?: unknown }).type === 'Formula'
        ))).toBe(false);
    });

    it('downloads a readable xlsx with the date-based filename', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-09-12T12:00:00.000Z'));

        await exportLatestResultsXlsx([
            makeResult({
                id: 'older',
                studentId: 'student-1',
                submittedAt: '2026-09-12T08:00:00.000Z',
                score: 6,
            }),
            makeResult({
                id: 'latest',
                studentId: 'student-1',
                submittedAt: '2026-09-12T09:00:00.000Z',
                score: 9,
                timeTaken: 18,
            }),
        ]);

        expect(mocks.saveAs).toHaveBeenCalledOnce();
        const [blob, filename] = mocks.saveAs.mock.calls[0] as [Blob, string];
        expect(filename).toBe('diem-moi-nhat-2026-09-12.xlsx');
        expect(blob).toBeInstanceOf(Blob);
        expect(blob.size).toBeGreaterThan(0);

        vi.useRealTimers();
        const { readSheet } = await import('read-excel-file/browser');
        const arrayBuffer = typeof blob.arrayBuffer === 'function'
            ? await blob.arrayBuffer()
            : await new Promise<ArrayBuffer>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as ArrayBuffer);
                reader.onerror = () => reject(reader.error);
                reader.readAsArrayBuffer(blob);
            });
        await expect(readSheet(arrayBuffer)).resolves.toEqual([
            ['STT', 'Họ và tên', 'Bài kiểm tra', 'Điểm', 'Thời gian làm'],
            [1, 'Nguyễn Văn An', 'quiz-1', 9, '18 phút'],
        ]);
    });
});
