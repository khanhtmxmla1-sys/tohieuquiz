import type React from 'react';
import { BatchModalHeader } from './BatchModalHeader';
import { BatchModalBody } from './BatchModalBody';
import { BatchModalFooter } from './BatchModalFooter';
import { CertificatePreviewOverlay } from './CertificatePreviewOverlay';
import { useBatchStudentSelection } from './useBatchStudentSelection';
import { useCertificateBatchData } from './useCertificateBatchData';
import { useCertificateBatchSubmit } from './useCertificateBatchSubmit';
import { useCertificatePreview } from './useCertificatePreview';
import type { BatchCreateModalProps } from './types';

const BatchCreateModal: React.FC<BatchCreateModalProps> = ({ onClose, onCreated, createBatch }) => {
  const data = useCertificateBatchData();
  const selection = useBatchStudentSelection(
    data.classStudents,
    data.results,
    data.quizId,
    data.quizzes,
  );
  const submit = useCertificateBatchSubmit(createBatch, onCreated);
  const preview = useCertificatePreview();
  const submitBatch = () => submit.submit({
    templateId: data.templateId,
    classId: data.classId,
    quizId: data.quizId,
    studentRows: selection.studentRows,
    selectedIds: selection.selectedIds,
  });
  const previewBatch = () => preview.preview({
    templateId: data.templateId,
    classId: data.classId,
    quizId: data.quizId,
    studentRows: selection.studentRows,
    selectedIds: selection.selectedIds,
    achievementPrefix: submit.achievementPrefix,
    dateLine: submit.dateLine,
    studentNameFont: submit.studentNameFont,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        <BatchModalHeader onClose={onClose} />
        <BatchModalBody data={data} selection={selection} submit={submit} />
        <BatchModalFooter
          selectedCount={selection.selectedIds.size}
          hasTemplates={data.templates.length > 0}
          isPreviewing={preview.isPreviewing}
          isSubmitting={submit.isSubmitting}
          onClose={onClose}
          onPreview={() => { void previewBatch(); }}
          onSubmit={() => { void submitBatch(); }}
        />
      </div>
      <CertificatePreviewOverlay
        previewUrl={preview.previewUrl}
        studentName={preview.previewStudentName}
        isSubmitting={submit.isSubmitting}
        onClose={preview.closePreview}
        onConfirm={() => {
          preview.closePreview();
          void submitBatch();
        }}
      />
    </div>
  );
};

export default BatchCreateModal;
