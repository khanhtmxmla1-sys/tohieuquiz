import { useCallback, useEffect, useState } from 'react';
import { showError } from '../../../utils/toast';
import { renderCertificatePreview } from './certificateBatchApi';
import type { BatchStudentRow, CertificatePreviewInput } from './types';

interface PreviewOptions extends Omit<CertificatePreviewInput, 'studentId'> {
  studentRows: BatchStudentRow[];
  selectedIds: Set<string>;
}

export const useCertificatePreview = () => {
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewStudentName, setPreviewStudentName] = useState('');

  const closePreview = useCallback(() => {
    setPreviewUrl(current => {
      if (current) URL.revokeObjectURL(current);
      return '';
    });
    setPreviewStudentName('');
  }, []);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const preview = useCallback(async (options: PreviewOptions) => {
    if (!options.templateId) {
      showError('Vui lòng chọn mẫu chứng nhận');
      return;
    }
    const previewStudent = options.studentRows.find(student => options.selectedIds.has(student.id));
    if (!previewStudent) {
      showError('Cần chọn ít nhất 1 học sinh để xem trước');
      return;
    }

    setIsPreviewing(true);
    try {
      const blob = await renderCertificatePreview({
        templateId: options.templateId,
        classId: options.classId,
        quizId: options.quizId,
        studentId: previewStudent.id,
        achievementPrefix: options.achievementPrefix,
        dateLine: options.dateLine,
        studentNameFont: options.studentNameFont,
      });
      const nextUrl = URL.createObjectURL(blob);
      setPreviewUrl(current => {
        if (current) URL.revokeObjectURL(current);
        return nextUrl;
      });
      setPreviewStudentName(previewStudent.fullName);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Không thể tạo ảnh xem trước');
    } finally {
      setIsPreviewing(false);
    }
  }, []);

  return { isPreviewing, previewUrl, previewStudentName, closePreview, preview };
};
