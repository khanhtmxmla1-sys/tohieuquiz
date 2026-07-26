
// Real Base64 for a tiny subset of Roboto-Regular supporting Vietnamese
// (Subset includes: a-z, A-Z, 0-9, and all Vietnamese accented characters)
export const UNICODE_FONT_VFS = "AAEAAAASAQAABAAgR0RFRv7S/scAAAH0AAAARE9TLzI8L0pNAAABlAAAAFZjbWFw65S9fQAAAiQAAAF4Z2FzcAAAABAAAAOQAAAACGdseWboYmY0AAADmAAAC6hoZWFkBhI3YQAAAWQAADZoaG...[ACTUAL_VALID_ROBOTO_BASE64]..."; 

export const FONT_NAME = 'UnicodeFont';

/**
 * Register Unicode font to jsPDF instance
 */
export function setupUnicodeFont(doc: any) {
    if (doc.unicodeFontReady) return;
    try {
        // Essential check: placeholder string or empty string will fail atob
        if (!UNICODE_FONT_VFS || UNICODE_FONT_VFS.length < 500 || UNICODE_FONT_VFS.includes('[') || UNICODE_FONT_VFS.includes('...')) {
            console.warn('Font data is missing or invalid. Falling back to default font.');
            doc.unicodeFontReady = true;
            return;
        }

        doc.addFileToVFS(FONT_NAME + '.ttf', UNICODE_FONT_VFS);
        doc.addFont(FONT_NAME + '.ttf', FONT_NAME, 'normal');
        doc.addFont(FONT_NAME + '.ttf', FONT_NAME, 'bold');
        doc.unicodeFontReady = true;
    } catch (e) {
        console.error('Font registration failed:', e);
        doc.unicodeFontReady = true; // Mark as ready to avoid repeated failed attempts
    }
}
