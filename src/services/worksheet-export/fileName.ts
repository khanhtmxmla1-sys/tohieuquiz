export type WorksheetFileExtension = 'pdf' | 'docx';

export function createWorksheetFileName(title: string, extension: WorksheetFileExtension): string {
    const safeTitle = title.replace(/[^a-zA-Z0-9\u00C0-\u024F\s]/g, '-').trim();
    return `vo-bai-tap-${safeTitle}.${extension}`;
}
