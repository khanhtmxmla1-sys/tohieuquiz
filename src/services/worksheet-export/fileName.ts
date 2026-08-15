export type WorksheetFileExtension = 'pdf' | 'docx';

export function createWorksheetFileName(title: string, extension: WorksheetFileExtension): string {
    const normalized = title.normalize('NFC')
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
        .replace(/[^\p{L}\p{N}\s.-]/gu, '-');
    const safeTitle = normalized
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^[.-]+|[.-]+$/g, '') || 'bai-tap';
    return `vo-bai-tap-${safeTitle}.${extension}`;
}
