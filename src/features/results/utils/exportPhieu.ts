/**
 * exportPhieu.ts
 * Các hàm xuất phiếu ra file PDF hoặc PNG sử dụng html2canvas + jsPDF.
 * Tên file = tên học sinh (sanitized).
 *
 * @blueprint senior-engineering-toolkit
 */

const sanitizeFileName = (name: string): string =>
  name
    .trim()
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_');

export async function exportPhieuAsPDF(
  element: HTMLElement,
  studentName: string,
): Promise<void> {
  const [html2canvas, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  const canvas = await html2canvas.default(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#f0f8ff',
    logging: false,
  });

  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const ratio  = canvas.width / canvas.height;
  const imgH   = pageW / ratio;
  const finalH  = Math.min(imgH, pageH);

  pdf.addImage(imgData, 'JPEG', 0, 0, pageW, finalH);
  pdf.save(`${sanitizeFileName(studentName)}.pdf`);
}

export async function exportPhieuAsImage(
  element: HTMLElement,
  studentName: string,
): Promise<void> {
  const html2canvas = await import('html2canvas');

  const canvas = await html2canvas.default(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#f0f8ff',
    logging: false,
  });

  const link = document.createElement('a');
  link.download = `${sanitizeFileName(studentName)}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
