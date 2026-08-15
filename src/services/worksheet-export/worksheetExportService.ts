import { exportWorksheetDocx } from './docx/docxDocument';
import { exportWorksheetPdf } from './pdf/pdfDocument';
import type { WorksheetExportOptions } from './types';
import { validateWorksheetRequiredVisuals } from './shared/media';

export async function exportWorksheet(opts: WorksheetExportOptions): Promise<void> {
    validateWorksheetRequiredVisuals(opts.quiz);
    if (opts.format === 'pdf') {
        await exportWorksheetPdf(opts);
        return;
    }
    await exportWorksheetDocx(opts);
}

export type {
    WorksheetAnswerKey,
    WorksheetExportOptions,
    WorksheetFormat,
    WorksheetPaperStyle,
} from './types';
