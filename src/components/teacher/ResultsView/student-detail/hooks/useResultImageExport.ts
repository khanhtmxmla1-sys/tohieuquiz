import type { RefObject } from 'react';
import type { StudentResult } from '../../../../../types';

import { showError, showLoading, showSuccess } from '@/src/utils/toast';

export const useResultImageExport = (
    reportRef: RefObject<HTMLDivElement | null>,
    result: StudentResult
) => {
    const handleExportImage = async () => {
        if (!reportRef.current) return;
        const loadingToast = showLoading('Đang chuẩn bị báo cáo...');
        try {
            const { default: html2canvas } = await import('html2canvas');
            const canvas = await html2canvas(reportRef.current, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#f8fafc',
            });
            const link = document.createElement('a');
            link.download = `Bao-cao-${result.studentName}-${result.quizTitle}.png`;
            link.href = canvas.toDataURL('image/png', 1.0);
            link.click();
            showSuccess('Đã tải xuống báo cáo!', { id: loadingToast });
        } catch (error) {
            console.error('Export error:', error);
            showError('Không thể xuất ảnh. Vui lòng thử lại.', { id: loadingToast });
        }
    };

    return handleExportImage;
};
