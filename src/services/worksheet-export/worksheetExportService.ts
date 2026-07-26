import { exportWorksheetDocx } from './docx/docxDocument';
import { exportWorksheetPdf } from './pdf/pdfDocument';
import type { WorksheetExportOptions } from './types';

export async function exportWorksheet(opts: WorksheetExportOptions): Promise<void> {
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
