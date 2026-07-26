import type { Quiz } from '../../types';

export type WorksheetFormat = 'pdf' | 'docx';
export type WorksheetPaperStyle = 'grid-5mm' | 'lined-wide' | 'blank';
export type WorksheetAnswerKey = 'none' | 'separate';

export interface WorksheetExportOptions {
    quiz: Quiz;
    format: WorksheetFormat;
    paperStyle: WorksheetPaperStyle;
    answerKey: WorksheetAnswerKey;
    schoolName?: string;
}
